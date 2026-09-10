use tauri::{AppHandle, State};

use crate::error::Result;
use crate::terminal::TerminalRegistry;

/// Abre uma sessão nova e devolve o seu id — a interface usa-o em todas as
/// chamadas seguintes para esta sessão.
#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    registry: State<'_, TerminalRegistry>,
    cols: u16,
    rows: u16,
) -> Result<String> {
    registry.spawn(app, cols, rows)
}

/// Escreve texto no stdin da sessão — é assim que um comando (ou uma tecla)
/// chega ao shell. Nunca um caminho de programa, só texto para uma sessão já
/// aberta.
#[tauri::command]
pub fn terminal_write(
    registry: State<'_, TerminalRegistry>,
    session_id: String,
    data: String,
) -> Result<()> {
    registry.write(&session_id, &data)
}

/// A janela mudou de tamanho — o shell precisa de saber para quebrar linhas
/// no sítio certo.
#[tauri::command]
pub fn terminal_resize(
    registry: State<'_, TerminalRegistry>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<()> {
    registry.resize(&session_id, cols, rows)
}

/// Termina o processo e liberta a sessão.
#[tauri::command]
pub fn terminal_kill(registry: State<'_, TerminalRegistry>, session_id: String) -> Result<()> {
    registry.kill(&session_id)
}
