use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::Result;

/// Estado partilhado do observador de pastas.
///
/// Um `HashMap` de `id → (pasta, flag de paragem)` — cada id corresponde a
/// uma pasta que alguma automação pediu para observar. O id é o próprio caminho,
/// normalizado, para deduplicar: duas automações a observar a mesma pasta
/// partilham o observador.
pub struct FileWatchers {
    inner: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl FileWatchers {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

/// Carga enviada para a interface quando um ficheiro muda.
#[derive(Clone, Serialize)]
struct FileChangeEvent {
    path: String,
    #[serde(rename = "watchId")]
    watch_id: String,
    #[serde(rename = "changeKind")]
    change_kind: String,
}

/// Começa a observar uma pasta.
///
/// Se a pasta já estiver a ser observada, não duplica o observador — devolve
/// Ok sem fazer nada.
///
/// O `id` que volta é o caminho normalizado (canonicalizado) — a interface
/// guarda-o para depois chamar `unwatch_folder`.
#[tauri::command]
pub fn watch_folder(
    app: AppHandle,
    watchers: State<'_, FileWatchers>,
    path: String,
) -> Result<String> {
    let normalized = PathBuf::from(&path);

    // Canonicalizar resolve caminhos relativos, links simbólicos e "..".
    // Sem isto, `C:\Users\..\Docs` e `C:\Users\Docs` seriam pastas diferentes.
    let canonical = normalized
        .canonicalize()
        .map_err(|e| {
            crate::error::Error::SystemRead(format!(
                "a pasta '{path}' não existe ou não se pode ler: {e}"
            ))
        })?;

    let watch_id = canonical.to_string_lossy().to_string();

    {
        let map = watchers.inner.lock().unwrap();
        if map.contains_key(&watch_id) {
            return Ok(watch_id);
        }
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    let flag = stop_flag.clone();
    let app_handle = app.clone();
    let id = watch_id.clone();

    thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        // `notify::recommended_watcher` escolhe o motor certo para o SO —
        // ReadDirectoryChangesW no Windows, FSEvents no macOS, inotify no Linux.
        let mut watcher = match notify::recommended_watcher(move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        }) {
            Ok(w) => w,
            Err(_) => return,
        };

        if watcher
            .watch(&canonical, RecursiveMode::NonRecursive)
            .is_err()
        {
            return;
        }

        // Loop que lê eventos do canal e os emite para a interface.
        // Sai quando a flag de paragem é levantada ou quando o canal fecha.
        loop {
            if flag.load(Ordering::Relaxed) {
                break;
            }

            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(event) => {
                    // O `notify` pode emitir vários tipos — interessa-nos
                    // qualquer alteração visível.
                    let change_kind = match event.kind {
                        EventKind::Create(_) => "created",
                        EventKind::Modify(_) => "modified",
                        EventKind::Remove(_) => "deleted",
                        _ => "any",
                    };

                    for path in &event.paths {
                        let _ = app_handle.emit(
                            "automation://file-changed",
                            FileChangeEvent {
                                path: path.to_string_lossy().to_string(),
                                watch_id: id.clone(),
                                change_kind: change_kind.to_owned(),
                            },
                        );
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Nada aconteceu neste segundo — continua.
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    {
        let mut map = watchers.inner.lock().unwrap();
        map.insert(watch_id.clone(), stop_flag);
    }

    Ok(watch_id)
}

/// Pára de observar uma pasta.
///
/// Idempotente: se a pasta já não estava a ser observada, devolve Ok.
#[tauri::command]
pub fn unwatch_folder(watchers: State<'_, FileWatchers>, watch_id: String) -> Result<()> {
    let mut map = watchers.inner.lock().unwrap();
    map.remove(&watch_id);
    // O observador vai parar no próximo tique do loop porque a flag sai do
    // escopo e o Drop levanta-a (ou é a última referência e o AtomicBool cai).
    Ok(())
}
