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

    /// Regista uma pasta como observada. Devolve `false` se já estava — nesse
    /// caso quem chama não deve criar um segundo observador.
    fn record(&self, watch_id: &str, flag: Arc<AtomicBool>) -> bool {
        let mut map = self.inner.lock().unwrap();
        if map.contains_key(watch_id) {
            return false;
        }
        map.insert(watch_id.to_string(), flag);
        true
    }

    /// Remove uma pasta e sinaliza a thread do observador para parar.
    ///
    /// A flag tem de ser posta a `true` aqui de propósito: a thread segura o
    /// seu próprio `Arc`, por isso tirá-lo do mapa não o destrói — e um
    /// `AtomicBool` não tem um `Drop` que o levante sozinho.
    fn remove(&self, watch_id: &str) {
        let mut map = self.inner.lock().unwrap();
        if let Some(flag) = map.remove(watch_id) {
            flag.store(true, Ordering::Relaxed);
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

    let stop_flag = Arc::new(AtomicBool::new(false));
    if !watchers.record(&watch_id, stop_flag.clone()) {
        return Ok(watch_id);
    }

    let flag = stop_flag;
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

    Ok(watch_id)
}

/// Pára de observar uma pasta.
///
/// Idempotente: se a pasta já não estava a ser observada, devolve Ok.
#[tauri::command]
pub fn unwatch_folder(watchers: State<'_, FileWatchers>, watch_id: String) -> Result<()> {
    watchers.remove(&watch_id);
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

/// Resolve `path` (ou a própria raiz, se omitido) e confirma que fica dentro
/// de `declared_root`. Recusa qualquer caminho fora dela, mesmo que pareça
/// válido (um `..` no caminho, um link simbólico a sair para fora) — a
/// canonicalização resolve os dois antes da comparação. É a única fronteira
/// que interessa: "nunca o disco todo" cumpre-se aqui, não na interface, que
/// só pode pedir educadamente. Separado do comando para ser testável sem um
/// `State` do Tauri, o mesmo padrão do `resolveWithinRoot` do Obsidian.
fn resolve_within_root(declared_root: &std::path::Path, path: Option<String>) -> Result<PathBuf> {
    let target = match path {
        Some(p) => PathBuf::from(p),
        None => declared_root.to_path_buf(),
    };

    let canonical_target = target.canonicalize().map_err(|e| {
        crate::error::Error::Files(format!("a pasta não existe ou não se pode ler: {e}"))
    })?;

    if !canonical_target.starts_with(declared_root) {
        return Err(crate::error::Error::Files(
            "fora da pasta-raiz escolhida — recusado.".to_string(),
        ));
    }

    Ok(canonical_target)
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

    let canonical_target = resolve_within_root(&declared_root, path)?;

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

#[cfg(test)]
mod tests {
    use super::*;

    /// Uma pasta temporária a sério, apagada sozinha ao sair de âmbito —
    /// mesmo padrão do `TempDir` de `voice_clone.rs`/`obsidian.rs`.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(nome: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("jarvis-files-teste-{nome}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> PathBuf {
            self.0.canonicalize().unwrap()
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// A fronteira que `files_read_dir` existe para impor — nunca tinha tido
    /// um teste (revisão a sério, item 15, 20/08/2026): só `FileWatchers`
    /// estava coberto neste ficheiro.
    #[test]
    fn le_a_propria_raiz_quando_o_caminho_e_omitido() {
        let raiz = TempDir::new("raiz-omitida");
        assert_eq!(resolve_within_root(&raiz.path(), None).unwrap(), raiz.path());
    }

    #[test]
    fn le_uma_subpasta_dentro_da_raiz() {
        let raiz = TempDir::new("subpasta");
        let sub = raiz.path().join("documentos");
        fs::create_dir(&sub).unwrap();

        let resolvido = resolve_within_root(&raiz.path(), Some(sub.to_string_lossy().into_owned()));
        assert_eq!(resolvido.unwrap(), sub.canonicalize().unwrap());
    }

    #[test]
    fn recusa_ponto_ponto_a_sair_da_raiz() {
        let raiz = TempDir::new("dotdot");
        let fora = raiz.path().join("..");

        assert!(resolve_within_root(&raiz.path(), Some(fora.to_string_lossy().into_owned())).is_err());
    }

    #[test]
    fn recusa_um_caminho_absoluto_completamente_fora_da_raiz() {
        let raiz = TempDir::new("raiz-absoluta");
        let outra = TempDir::new("outra-pasta");

        let resultado =
            resolve_within_root(&raiz.path(), Some(outra.path().to_string_lossy().into_owned()));
        assert!(resultado.is_err());
    }

    #[test]
    fn recusa_uma_pasta_irma_cujo_nome_comeca_pelo_da_raiz() {
        // O caso que uma comparação de strings (em vez de componentes de
        // caminho) apanharia mal: "raiz-vizinha-2" começa pela string
        // "raiz-vizinha", mas não é uma subpasta dela. `Path::starts_with`
        // compara componentes, não seria enganado por isto — confirma-se.
        let raiz = TempDir::new("raiz-vizinha");
        let vizinha = TempDir::new("raiz-vizinha-2");

        let resultado =
            resolve_within_root(&raiz.path(), Some(vizinha.path().to_string_lossy().into_owned()));
        assert!(resultado.is_err());
    }

    /// Só em Unix — criar um link simbólico no Windows por omissão pede um
    /// privilégio que a maioria das contas não tem, e a lógica corrigida
    /// (canonicalizar antes de comparar) é a mesma nos dois SOs. Mesmo
    /// padrão do `obsidian.rs`.
    #[cfg(unix)]
    #[test]
    fn recusa_link_simbolico_a_apontar_para_fora_da_raiz() {
        use std::os::unix::fs::symlink;

        let raiz = TempDir::new("symlink-raiz");
        let fora = TempDir::new("symlink-alvo");
        symlink(fora.path(), raiz.path().join("atalho")).unwrap();

        let alvo = raiz.path().join("atalho");
        let resultado = resolve_within_root(&raiz.path(), Some(alvo.to_string_lossy().into_owned()));
        assert!(resultado.is_err());
    }

    #[test]
    fn remove_para_a_thread_do_observador() {
        let watchers = FileWatchers::new();
        let flag = Arc::new(AtomicBool::new(false));
        assert!(watchers.record("pasta", flag.clone()));

        // Simula o ciclo da thread do observador: só sai quando a flag é
        // levantada. O limite de iterações evita que uma regressão (fuga)
        // deixe o teste pendurado para sempre — se a flag nunca subir,
        // `esgotou` fica a `true` e o teste falha em vez de bloquear.
        let esgotou = Arc::new(AtomicBool::new(false));
        let sinal = esgotou.clone();
        let f = flag.clone();
        let thread = thread::spawn(move || {
            for _ in 0..1000 {
                if f.load(Ordering::Relaxed) {
                    return;
                }
                thread::sleep(Duration::from_millis(1));
            }
            sinal.store(true, Ordering::Relaxed);
        });

        watchers.remove("pasta");
        thread.join().unwrap();

        assert!(!esgotou.load(Ordering::Relaxed));
    }

    #[test]
    fn remove_de_uma_pasta_inexistente_e_idempotente() {
        let watchers = FileWatchers::new();
        watchers.remove("nunca-observada");
    }

    #[test]
    fn record_nao_duplica_a_mesma_pasta() {
        let watchers = FileWatchers::new();
        let primeira = Arc::new(AtomicBool::new(false));
        let segunda = Arc::new(AtomicBool::new(false));

        assert!(watchers.record("pasta", primeira.clone()));
        assert!(!watchers.record("pasta", segunda.clone()));

        // A primeira flag continua no mapa — a segunda foi ignorada.
        let map = watchers.inner.lock().unwrap();
        let guardada = map.get("pasta").unwrap();
        assert!(Arc::ptr_eq(guardada, &primeira));
    }
}
