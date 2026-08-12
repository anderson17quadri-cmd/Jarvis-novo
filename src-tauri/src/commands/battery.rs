use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::Result;

const POLL_INTERVAL: Duration = Duration::from_secs(30);

/// O que a interface recebe quando o nível da bateria muda.
#[derive(Clone, Serialize)]
pub struct BatteryEvent {
    percent: u8,
    #[serde(rename = "isCharging")]
    is_charging: bool,
    #[serde(rename = "isPlugged")]
    is_plugged: bool,
}

/// Monitor de bateria que emite eventos para a interface.
///
/// Corre numa thread separada e lê o estado da bateria a cada 30s.
/// Quando a percentagem ou o estado de carregamento mudam, emite
/// `automation://battery-changed` com os novos valores.
pub struct BatteryMonitor {
    stop_flag: Arc<AtomicBool>,
}

impl BatteryMonitor {
    pub fn start(app: AppHandle) -> Self {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let flag = stop_flag.clone();

        thread::spawn(move || {
            let manager = match battery::Manager::new() {
                Ok(m) => m,
                Err(_) => {
                    // Sem bateria (desktop sem UPS) — o monitor fica quieto,
                    // sem nunca emitir eventos. Não é erro.
                    return;
                }
            };

            let mut last: Option<BatteryEvent> = None;

            while !flag.load(Ordering::Relaxed) {
                let current = Self::read(&manager);

                // Só emite se alguma coisa mudou — evita spam de eventos
                // idênticos a cada 30s.
                let changed = match (&last, &current) {
                    (None, Some(_)) => true,
                    (Some(prev), Some(cur)) => {
                        prev.percent != cur.percent
                            || prev.is_charging != cur.is_charging
                            || prev.is_plugged != cur.is_plugged
                    }
                    _ => false,
                };

                if let Some(ref event) = current {
                    if changed {
                        let _ = app.emit("automation://battery-changed", event.clone());
                    }
                }

                last = current;
                thread::sleep(POLL_INTERVAL);
            }
        });

        Self { stop_flag }
    }

    fn read(manager: &battery::Manager) -> Option<BatteryEvent> {
        let batteries = manager.batteries().ok()?;
        // Agrega a primeira bateria. Portáteis com uma só bateria são o caso
        // comum; quem tiver mais do que uma (ex.: bateria externa + interna)
        // vê só a primeira reportada pelo SO.
        let battery = batteries.into_iter().next()?.ok()?;

        Some(BatteryEvent {
            percent: (battery.state_of_charge().value * 100.0).round() as u8,
            is_charging: battery.state() == battery::State::Charging,
            is_plugged: battery.state() != battery::State::Discharging,
        })
    }
}

impl Drop for BatteryMonitor {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

/// Leitura única do estado da bateria.
///
/// Devolve `None` se não houver bateria (desktop fixo sem UPS) ou se a leitura
/// falhar — não é erro, é ausência da peça. A interface decide se mostra ou não.
#[tauri::command]
pub fn get_battery_status() -> Result<Option<BatteryEvent>> {
    let manager = match battery::Manager::new() {
        Ok(m) => m,
        Err(_) => return Ok(None),
    };

    let batteries = manager.batteries().map_err(|e| {
        crate::error::Error::SystemRead(format!("não deu para ler a bateria: {e}"))
    })?;

    let battery = match batteries.into_iter().next() {
        Some(b) => b.map_err(|e| {
            crate::error::Error::SystemRead(format!("não deu para ler a bateria: {e}"))
        })?,
        None => return Ok(None),
    };

    Ok(Some(BatteryEvent {
        percent: (battery.state_of_charge().value * 100.0).round() as u8,
        is_charging: battery.state() == battery::State::Charging,
        is_plugged: battery.state() != battery::State::Discharging,
    }))
}
