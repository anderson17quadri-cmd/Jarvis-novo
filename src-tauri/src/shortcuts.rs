use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::tray;

/// Atalho global para invocar o Jarvis de qualquer sítio: CTRL + ALT + J.
fn invoke_accelerator() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyJ)
}

/// Evento enviado à interface quando o atalho global dispara.
/// A interface reage abrindo a command palette e pondo o núcleo à escuta.
pub const INVOKE_EVENT: &str = "jarvis://global-invoke";

/// Regista o atalho global. Só desktop — no Android não há atalhos globais.
///
/// Falhar aqui não pode derrubar o arranque: se outro programa já tiver o
/// atalho registado, a aplicação continua a funcionar sem ele.
pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let result = app.global_shortcut().on_shortcut(invoke_accelerator(), |app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        tray::focus_main(app);
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit(INVOKE_EVENT, ());
        }
    });

    if let Err(err) = result {
        eprintln!("[jarvis] não foi possível registar o atalho global (CTRL+ALT+J): {err}");
    }

    Ok(())
}
