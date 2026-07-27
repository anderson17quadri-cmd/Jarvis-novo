use tauri::State;

#[cfg(mobile)]
use crate::error::Error;
use crate::error::Result;
use crate::system::metrics::{ProcessInfo, StaticSystemInfo, SystemSnapshot};
use crate::system::SystemMonitor;

/// Quantos processos devolver quando a interface não especifica.
const DEFAULT_PROCESS_LIMIT: usize = 8;
/// Teto rígido — impede que a interface peça uma lista de milhares.
const MAX_PROCESS_LIMIT: usize = 50;

/// Leitura completa: CPU, memória, disco e rede.
#[tauri::command]
pub fn get_system_snapshot(monitor: State<'_, SystemMonitor>) -> Result<SystemSnapshot> {
    monitor.snapshot()
}

/// Dados que não mudam durante a sessão. A interface lê uma vez e guarda.
#[tauri::command]
pub fn get_static_system_info(monitor: State<'_, SystemMonitor>) -> Result<StaticSystemInfo> {
    monitor.static_info()
}

/// Processos que mais CPU consomem.
///
/// O Android isola as aplicações e não deixa ler os processos das outras — daí
/// o erro explícito. O `AndroidAdapter` nem chega a chamar este comando, mas se
/// alguém o invocar recebe uma recusa clara em vez de uma lista falsa.
#[cfg(mobile)]
#[tauri::command]
pub fn get_top_processes(
    _monitor: State<'_, SystemMonitor>,
    _limit: Option<usize>,
) -> Result<Vec<ProcessInfo>> {
    Err(Error::Unsupported(
        "a leitura de processos não está disponível no Android".to_owned(),
    ))
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_top_processes(
    monitor: State<'_, SystemMonitor>,
    limit: Option<usize>,
) -> Result<Vec<ProcessInfo>> {
    let limit = limit.unwrap_or(DEFAULT_PROCESS_LIMIT).clamp(1, MAX_PROCESS_LIMIT);
    monitor.top_processes(limit)
}
