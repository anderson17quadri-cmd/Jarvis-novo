mod commands;
mod error;
mod system;

#[cfg(desktop)]
mod shortcuts;
#[cfg(desktop)]
mod terminal;
#[cfg(desktop)]
mod tray;
#[cfg(desktop)]
mod voice_clone;
#[cfg(target_os = "windows")]
mod windows_hello;

use tauri::Manager;
use system::SystemMonitor;
#[cfg(desktop)]
use terminal::TerminalRegistry;

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
        // Fechar a janela principal esconde-a na bandeja em vez de fechar a app.
        // O motor de automações continua a correr com a janela escondida — só o
        // item "Sair" da bandeja é que fecha mesmo.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        });

    #[cfg(not(desktop))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::system::get_system_snapshot,
        commands::system::get_static_system_info,
        commands::system::get_top_processes,
    ]);

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(voice_clone::VoiceCloneProcess(std::sync::Mutex::new(None)))
        .manage(TerminalRegistry::default())
        .manage(commands::files::FileWatchers::new())
        .manage(commands::files::FilesRoot::new())
        .manage(commands::music::MusicRoot::new())
        .manage(commands::obsidian::ObsidianRoot::new())
        // O Terminal, o cofre de segredos, o Windows Hello e os gatilhos
        // nativos só existem no desktop — sem isto, `generate_handler!`
        // teria de referenciar comandos que não compilam no Android. Só há
        // UM `invoke_handler` por ramo: chamá-lo outra vez substitui o
        // anterior em vez de acumular. A lista inclui sistema (3), terminal
        // (4), cofre (3), Windows Hello (2, mesma assinatura em qualquer
        // desktop — "indisponível" em vez de não compilar fora do Windows,
        // ver commands/windows_hello.rs), bateria (1), ficheiros (4: dois
        // gatilhos de automação + declarar raiz/ler pasta do Explorador
        // real), USB (0 — não há comandos invocáveis, o monitor arranca
        // sozinho no setup) e Obsidian (4: declarar vault, listar, ler e
        // escrever notas).
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_snapshot,
            commands::system::get_static_system_info,
            commands::system::get_top_processes,
            commands::terminal::terminal_spawn,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::secrets::secret_set,
            commands::secrets::secret_get,
            commands::secrets::secret_delete,
            commands::windows_hello::windows_hello_available,
            commands::windows_hello::windows_hello_verify,
            commands::battery::get_battery_status,
            commands::files::watch_folder,
            commands::files::unwatch_folder,
            commands::files::files_set_root,
            commands::files::files_read_dir,
            commands::plugins::read_plugin_file,
            commands::mail::mail_fetch,
            commands::mail::mail_set_flag,
            commands::mail::mail_send,
            commands::music::music_set_root,
            commands::music::music_read_dir,
            commands::obsidian::obsidian_set_root,
            commands::obsidian::obsidian_list_notes,
            commands::obsidian::obsidian_read_note,
            commands::obsidian::obsidian_write_note,
            commands::browser::fetch_page_text,
        ])
        .setup(|app| {
            tray::setup(app.handle())?;
            shortcuts::setup(app.handle())?;
            voice_clone::setup(app.handle());

            // Monitores de fundo para os gatilhos de automação (Parte 13).
            // Cada um corre numa thread própria e emite eventos Tauri quando
            // deteta mudanças. A interface escuta esses eventos e dispara as
            // regras que correspondem.
            //
            // Guardados como estado gerido para viverem o tempo de vida da app.
            // Sem isto, cairiam no fim do setup e as threads paravam.
            let battery = commands::battery::BatteryMonitor::start(app.handle().clone());
            app.manage(battery);

            // O monitor de USB só existe no Windows (ver commands/mod.rs) —
            // `SetupDiGetClassDevsW` não tem equivalente noutro desktop.
            #[cfg(target_os = "windows")]
            {
                let usb = commands::usb::UsbMonitor::start(app.handle().clone());
                app.manage(usb);
            }

            Ok(())
        });

    match builder.build(tauri::generate_context!()) {
        Ok(app) => app.run(|_app_handle, _event| {
            #[cfg(desktop)]
            if let tauri::RunEvent::Exit = _event {
                voice_clone::cleanup(_app_handle);
            }
        }),
        Err(err) => eprintln!("[jarvis] a aplicação terminou com erro: {err}"),
    }
}
