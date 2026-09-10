use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::Result;

const POLL_INTERVAL: Duration = Duration::from_secs(30);

/// O que a interface recebe quando o nível da bateria muda.
#[derive(Clone, Serialize, PartialEq, Debug)]
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
                let (changed, next) = Self::diff(last, current);

                if changed {
                    if let Some(ref event) = next {
                        let _ = app.emit("automation://battery-changed", event.clone());
                    }
                }

                last = next;
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

    /// Decide se há mudança a anunciar, e o que `last` passa a ser no ciclo
    /// seguinte. Uma leitura falhada (`current: None` — driver com um
    /// engasgo momentâneo, não falta de bateria, que já falha mais cedo em
    /// `start()`) nunca apaga o último estado bom: `next` guarda-o com
    /// `current.or(last)`, para a leitura seguinte comparar contra o último
    /// valor real, não contra `None`. Sem isto, uma falha transitória fazia
    /// `last` esquecer-se, e a leitura seguinte — mesmo que idêntica à de
    /// antes da falha — parecia "nova" outra vez, emitindo um evento que
    /// nada tinha mudado para justificar. Separado da thread para ser
    /// testável sem bateria nenhuma a sério.
    fn diff(
        last: Option<BatteryEvent>,
        current: Option<BatteryEvent>,
    ) -> (bool, Option<BatteryEvent>) {
        let changed = match (&last, &current) {
            (None, Some(_)) => true,
            (Some(prev), Some(cur)) => prev != cur,
            _ => false,
        };
        let next = current.or(last);
        (changed, next)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn event(percent: u8) -> BatteryEvent {
        BatteryEvent { percent, is_charging: false, is_plugged: false }
    }

    #[test]
    fn a_primeira_leitura_boa_conta_como_mudanca() {
        let (changed, next) = BatteryMonitor::diff(None, Some(event(80)));
        assert!(changed);
        assert_eq!(next, Some(event(80)));
    }

    #[test]
    fn a_mesma_leitura_outra_vez_nao_e_mudanca() {
        let (changed, next) = BatteryMonitor::diff(Some(event(80)), Some(event(80)));
        assert!(!changed);
        assert_eq!(next, Some(event(80)));
    }

    #[test]
    fn uma_leitura_diferente_e_mudanca() {
        let (changed, next) = BatteryMonitor::diff(Some(event(80)), Some(event(79)));
        assert!(changed);
        assert_eq!(next, Some(event(79)));
    }

    /// O achado desta revisão (item 15, 20/08/2026): uma leitura falhada
    /// (o gestor de bateria devolveu `None` num ciclo, sem ser falta de
    /// bateria) não podia apagar o último estado bom — sem isto, a leitura
    /// seguinte, mesmo idêntica à de antes da falha, parecia "nova".
    #[test]
    fn uma_leitura_falhada_nao_apaga_o_ultimo_estado_bom() {
        let (changed_na_falha, next) = BatteryMonitor::diff(Some(event(80)), None);
        assert!(!changed_na_falha);
        assert_eq!(next, Some(event(80)));

        // O ciclo seguinte, com a mesma leitura de antes da falha, não é
        // tratado como mudança — porque `next` preservou o estado bom.
        let (changed_depois, _) = BatteryMonitor::diff(next, Some(event(80)));
        assert!(!changed_depois);
    }

    #[test]
    fn duas_leituras_falhadas_seguidas_continuam_sem_mudanca() {
        let (changed, next) = BatteryMonitor::diff(None, None);
        assert!(!changed);
        assert_eq!(next, None);
    }
}
