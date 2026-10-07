use serde::Serialize;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct NetworkEvent {
    connected: bool,
    previous_connected: Option<bool>,
}

/// A leitura inicial estabelece a base; uma falha conserva a última leitura.
fn transition(previous: Option<bool>, current: Option<bool>) -> (Option<NetworkEvent>, Option<bool>) {
    let event = current.filter(|value| Some(*value) != previous).map(|connected| NetworkEvent {
        connected, previous_connected: previous,
    });
    (event, current.or(previous))
}

#[cfg(target_os = "windows")]
fn read() -> Option<bool> {
    use windows::Win32::Networking::NetworkListManager::{INetworkListManager, NetworkListManager};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED};
    struct ComGuard;
    impl Drop for ComGuard { fn drop(&mut self) { unsafe { CoUninitialize(); } } }
    // Cada chamada acontece numa thread própria que ainda não usa COM.
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok().ok()?;
        let _guard = ComGuard;
        let manager: INetworkListManager = CoCreateInstance(&NetworkListManager, None, CLSCTX_ALL).ok()?;
        Some(manager.GetConnectivity().ok()?.0 != 0)
    }
}

#[cfg(not(target_os = "windows"))]
fn read() -> Option<bool> { None }

pub struct NetworkMonitor { stop: Arc<AtomicBool> }
impl NetworkMonitor {
    pub fn start(app: AppHandle) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        thread::spawn(move || {
            let mut previous = None;
            while !flag.load(Ordering::Relaxed) {
                let (event, next) = transition(previous, read());
                previous = next;
                if let Some(event) = event { let _ = app.emit("automation://network-changed", event); }
                thread::sleep(Duration::from_secs(5));
            }
        });
        Self { stop }
    }
}
impl Drop for NetworkMonitor { fn drop(&mut self) { self.stop.store(true, Ordering::Relaxed); } }

/// Estado da ligação local reportado pelo SO; não prova acesso à Internet.
#[tauri::command]
pub fn get_network_status() -> Option<bool> { thread::spawn(read).join().ok().flatten() }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn initial_snapshot_is_not_a_transition() {
        assert_eq!(transition(None, Some(true)).0.unwrap().previous_connected, None);
    }
    #[test]
    fn lost_connection_preserves_previous_state_in_event() {
        assert_eq!(transition(Some(true), Some(false)).0, Some(NetworkEvent { connected: false, previous_connected: Some(true) }));
    }
    #[test]
    fn unchanged_and_failed_reads_emit_nothing() {
        assert_eq!(transition(Some(true), Some(true)), (None, Some(true)));
        assert_eq!(transition(Some(true), None), (None, Some(true)));
    }
    #[test]
    fn windows_api_can_report_this_machine_without_changing_network() {
        #[cfg(target_os = "windows")]
        assert!(thread::spawn(read).join().unwrap().is_some());
    }
}
