use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, UNIX_EPOCH};

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

/// A pasta-raiz declarada para o Explorador real (Parte 6.1).
///
/// Sem isto, `files_read_dir` teria de confiar em qualquer caminho que a
/// interface mandasse — e a interface só é tão confiável quanto o que o
/// modelo de IA lhe puser à frente algures. A raiz só muda por
/// `files_set_root`, chamado depois de a pessoa escolher a pasta pelo
/// diálogo nativo; qualquer leitura fora dela é recusada aqui, no Rust, não
/// só escondida na interface.
pub struct FilesRoot {
    inner: Mutex<Option<PathBuf>>,
}

impl FilesRoot {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl Default for FilesRoot {
    fn default() -> Self {
        Self::new()
    }
}

/// Uma entrada real do disco, para a interface.
#[derive(Clone, Serialize)]
pub struct RealFileEntry {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    #[serde(rename = "sizeBytes")]
    size_bytes: Option<u64>,
    #[serde(rename = "modifiedAt")]
    modified_at: i64,
}

/// A pasta-raiz, depois de declarada.
#[derive(Clone, Serialize)]
pub struct RealFilesRoot {
    path: String,
    name: String,
}

/// Declara a pasta-raiz do Explorador real.
///
/// Chamado com o caminho que o diálogo nativo devolveu (ou uma raiz
/// guardada de uma sessão anterior, a reafirmar-se no arranque — o estado
/// gerido não sobrevive a fechar a aplicação). Substitui qualquer raiz
/// anterior: só há uma de cada vez.
#[tauri::command]
pub fn files_set_root(root: State<'_, FilesRoot>, path: String) -> Result<RealFilesRoot> {
    let canonical = PathBuf::from(&path).canonicalize().map_err(|e| {
        crate::error::Error::Files(format!(
            "a pasta '{path}' não existe ou não se pode ler: {e}"
        ))
    })?;

    if !canonical.is_dir() {
        return Err(crate::error::Error::Files(format!(
            "'{path}' não é uma pasta."
        )));
    }

    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| canonical.to_string_lossy().to_string());
    let canonical_path = canonical.to_string_lossy().to_string();

    let mut guard = root.inner.lock().unwrap();
    *guard = Some(canonical);

    Ok(RealFilesRoot {
        path: canonical_path,
        name,
    })
}

/// Lê um nível de uma pasta real — a raiz declarada, se `path` for omitido.
///
/// Recusa qualquer caminho fora da raiz declarada, mesmo que pareça válido
/// (um `..` no caminho, um link simbólico a sair para fora). É a única
/// fronteira que interessa: "nunca o disco todo" cumpre-se aqui, não na
/// interface, que só pode pedir educadamente.
#[tauri::command]
pub fn files_read_dir(
    root: State<'_, FilesRoot>,
    path: Option<String>,
) -> Result<Vec<RealFileEntry>> {
    let declared_root = {
        let guard = root.inner.lock().unwrap();
        guard.clone().ok_or_else(|| {
            crate::error::Error::Files("nenhuma pasta-raiz escolhida ainda.".to_string())
        })?
    };

    let target = match path {
        Some(p) => PathBuf::from(p),
        None => declared_root.clone(),
    };

    let canonical_target = target.canonicalize().map_err(|e| {
        crate::error::Error::Files(format!("a pasta não existe ou não se pode ler: {e}"))
    })?;

    if !canonical_target.starts_with(&declared_root) {
        return Err(crate::error::Error::Files(
            "fora da pasta-raiz escolhida — recusado.".to_string(),
        ));
    }

    let read_dir = fs::read_dir(&canonical_target).map_err(|e| {
        crate::error::Error::Files(format!("não consegui ler a pasta: {e}"))
    })?;

    let mut entries = Vec::new();

    for item in read_dir {
        // Uma entrada individual que falha a ler (permissão, ficheiro
        // apagado a meio da listagem) não pode rebentar a pasta inteira —
        // fica de fora, e as outras aparecem na mesma.
        let Ok(item) = item else { continue };
        let Ok(metadata) = item.metadata() else { continue };

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0);

        entries.push(RealFileEntry {
            name: item.file_name().to_string_lossy().to_string(),
            path: item.path().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size_bytes: if metadata.is_dir() {
                None
            } else {
                Some(metadata.len())
            },
            modified_at,
        });
    }

    Ok(entries)
}
