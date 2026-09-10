use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Lista de dispositivos USB que o monitor já conhece.
///
/// Guardada entre leituras para comparar e perceber se algum entrou ou saiu.
struct UsbState {
    known: Vec<String>,
    first: bool,
}

/// Carga enviada para a interface quando um dispositivo muda.
#[derive(Clone, Serialize)]
struct UsbEvent {
    action: String,
    #[serde(rename = "deviceName")]
    device_name: Option<String>,
}

/// Monitor de ligação/desligação de dispositivos USB.
///
/// Corre numa thread com polling a cada 5s. Usa `SetupDiGetClassDevsW` para
/// enumerar os dispositivos atuais e compara com a lista conhecida para
/// detetar entradas e saídas.
pub struct UsbMonitor {
    flag: Arc<AtomicBool>,
}

impl UsbMonitor {
    pub fn start(app: AppHandle) -> Self {
        let flag = Arc::new(AtomicBool::new(false));
        let f = flag.clone();
        let state = Arc::new(Mutex::new(UsbState {
            known: Vec::new(),
            first: true,
        }));

        thread::spawn(move || {
            let interval = Duration::from_secs(5);

            while !f.load(Ordering::Relaxed) {
                let current = list_usb_devices();

                let mut guard = state.lock().unwrap();

                if guard.first {
                    guard.known = current;
                    guard.first = false;
                } else {
                    let (connected, disconnected) = diff_devices(&guard.known, &current);

                    for dev in connected {
                        let _ = app.emit(
                            "automation://usb-changed",
                            UsbEvent { action: "ligado".to_owned(), device_name: Some(dev) },
                        );
                    }

                    for dev in disconnected {
                        let _ = app.emit(
                            "automation://usb-changed",
                            UsbEvent { action: "desligado".to_owned(), device_name: Some(dev) },
                        );
                    }

                    guard.known = current;
                }

                drop(guard);
                thread::sleep(interval);
            }
        });

        Self { flag }
    }
}

impl Drop for UsbMonitor {
    fn drop(&mut self) {
        self.flag.store(true, Ordering::Relaxed);
    }
}

/// Compara a lista conhecida com a atual e devolve quem ligou e quem
/// desligou. Separada da thread (que fala com `SetupDiGetClassDevsW`, sem
/// se prestar a teste automatizado sem hardware a sério) para a lógica de
/// diferença — a parte que pode ter um bug — ser testável com listas
/// simples, sem USB nenhum ligado.
fn diff_devices(known: &[String], current: &[String]) -> (Vec<String>, Vec<String>) {
    let connected = current
        .iter()
        .filter(|dev| !known.contains(dev))
        .cloned()
        .collect();
    let disconnected = known
        .iter()
        .filter(|dev| !current.contains(dev))
        .cloned()
        .collect();
    (connected, disconnected)
}

/// Enumera dispositivos USB atualmente ligados pelo seu "device instance ID".
fn list_usb_devices() -> Vec<String> {
    use windows::core::GUID;
    use windows::Win32::Devices::DeviceAndDriverInstallation::{
        SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
        SetupDiGetDeviceInstanceIdW, DIGCF_DEVICEINTERFACE, DIGCF_PRESENT, SP_DEVINFO_DATA,
    };

    // GUID_DEVINTERFACE_USB_DEVICE: {A5DCBF10-6530-11D2-901F-00C04FB951ED}
    let usb_guid = GUID::from_values(
        0xA5DCBF10,
        0x6530,
        0x11D2,
        [0x90, 0x1F, 0x00, 0xC0, 0x4F, 0xB9, 0x51, 0xED],
    );

    let Ok(device_info_set) = (unsafe {
        SetupDiGetClassDevsW(
            Some(&usb_guid),
            None,
            None,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
        )
    }) else {
        return Vec::new();
    };

    let mut devices = Vec::new();
    let mut info = SP_DEVINFO_DATA {
        cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
        ..Default::default()
    };

    let mut idx = 0u32;
    loop {
        if unsafe { SetupDiEnumDeviceInfo(device_info_set, idx, &mut info) }.is_err() {
            break;
        }

        let mut buf = vec![0u16; 256];
        if unsafe {
            SetupDiGetDeviceInstanceIdW(
                device_info_set,
                &info,
                Some(buf.as_mut_slice()),
                None,
            )
        }
        .is_ok()
        {
            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            if len > 0 {
                let id = OsString::from_wide(&buf[..len])
                    .to_string_lossy()
                    .to_string();
                devices.push(id);
            }
        }

        idx += 1;
    }

    unsafe {
        let _ = SetupDiDestroyDeviceInfoList(device_info_set);
    }

    devices
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn nenhuma_mudanca_quando_as_listas_sao_iguais() {
        let known = strings(&["A", "B"]);
        let current = strings(&["A", "B"]);

        let (connected, disconnected) = diff_devices(&known, &current);
        assert!(connected.is_empty());
        assert!(disconnected.is_empty());
    }

    #[test]
    fn um_dispositivo_novo_conta_como_ligado() {
        let known = strings(&["A"]);
        let current = strings(&["A", "B"]);

        let (connected, disconnected) = diff_devices(&known, &current);
        assert_eq!(connected, strings(&["B"]));
        assert!(disconnected.is_empty());
    }

    #[test]
    fn um_dispositivo_que_desapareceu_conta_como_desligado() {
        let known = strings(&["A", "B"]);
        let current = strings(&["A"]);

        let (connected, disconnected) = diff_devices(&known, &current);
        assert!(connected.is_empty());
        assert_eq!(disconnected, strings(&["B"]));
    }

    #[test]
    fn troca_simultanea_apanha_os_dois_lados() {
        let known = strings(&["A", "B"]);
        let current = strings(&["A", "C"]);

        let (connected, disconnected) = diff_devices(&known, &current);
        assert_eq!(connected, strings(&["C"]));
        assert_eq!(disconnected, strings(&["B"]));
    }

    #[test]
    fn duas_listas_vazias_nao_dao_evento_nenhum() {
        let (connected, disconnected) = diff_devices(&[], &[]);
        assert!(connected.is_empty());
        assert!(disconnected.is_empty());
    }
}
