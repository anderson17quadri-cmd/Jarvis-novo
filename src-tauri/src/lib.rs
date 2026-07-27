mod commands;
mod error;
mod system;

#[cfg(desktop)]
mod shortcuts;
#[cfg(desktop)]
mod tray;

use system::SystemMonitor;

/// Ponto de entrada partilhado por desktop e Android.
///
/// O atributo `mobile_entry_point` faz o Android chamar esta função a partir do
/// `MainActivity` gerado; no desktop é o `main.rs` que a chama.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        // O monitor de sistema é estado partilhado: o `sysinfo::System` precisa
        // de duas leituras para calcular a percentagem de CPU, por isso tem de
        // sobreviver entre chamadas em vez de ser criado a cada comando.
        .manage(SystemMonitor::new())
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_snapshot,
            commands::system::get_static_system_info,
            commands::system::get_top_processes,
        ]);

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            tray::setup(app.handle())?;
            shortcuts::setup(app.handle())?;
            Ok(())
        });

    if let Err(err) = builder.run(tauri::generate_context!()) {
        eprintln!("[jarvis] a aplicação terminou com erro: {err}");
    }
}
