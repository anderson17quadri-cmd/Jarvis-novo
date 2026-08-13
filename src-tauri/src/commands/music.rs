use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::error::{Error, Result};

/// Extensões de áudio que a reprodução local reconhece.
///
/// Uma lista pequena e fechada, não "qualquer ficheiro": o `<audio>` do WebView
/// consegue tocar mais formatos (depende do motor), mas aceitar tudo seria
/// declarar "a pasta de música é uma pasta de ficheiros". Estas são as comuns,
/// sem surpresas de codec.
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"];

/// A pasta de música declarada para a reprodução local (Peça 8, lote 2).
///
/// Serve o mesmo papel do `FilesRoot` do Explorador real, mas é um estado
/// separado: a pasta da música não é (nem deve ser) a pasta do Explorador, e
/// acoplar os dois faria mexer numa funcionalidade que está pronta. A raiz só
/// muda por `music_set_root`, e só os ficheiros dentro dela são devolvidos.
pub struct MusicRoot {
    inner: Mutex<Option<PathBuf>>,
}

impl MusicRoot {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl Default for MusicRoot {
    fn default() -> Self {
        Self::new()
    }
}

/// Um ficheiro de áudio real, para a interface.
#[derive(Clone, Serialize)]
pub struct MusicFileEntry {
    name: String,
    path: String,
}

/// A pasta de música, depois de declarada.
#[derive(Clone, Serialize)]
pub struct RealMusicRoot {
    path: String,
    name: String,
}

/// Declara a pasta de música local e alarga-lhe o protocolo `asset`.
///
/// Chamado com o caminho que o diálogo nativo devolveu (ou uma pasta guardada
/// de uma sessão anterior, a reafirmar-se no arranque — o estado gerido não
/// sobrevive a fechar a aplicação). Além de guardar a raiz, alarga o âmbito do
/// protocolo `asset` do Tauri a essa pasta: sem isso o elemento `<audio>` da
/// interface não conseguiria carregar os ficheiros por `asset://localhost/…`,
/// mesmo com o caminho certo.
#[tauri::command]
pub fn music_set_root(
    app: AppHandle,
    root: State<'_, MusicRoot>,
    path: String,
) -> Result<RealMusicRoot> {
    let canonical = PathBuf::from(&path).canonicalize().map_err(|e| {
        Error::Files(format!("a pasta '{path}' não existe ou não se pode ler: {e}"))
    })?;

    if !canonical.is_dir() {
        return Err(Error::Files(format!("'{path}' não é uma pasta.")));
    }

    // O âmbito do `asset` é alargado em runtime — é a API pública do Tauri
    // (`Scopes::allow_directory`). Recursivo, para a música poder estar em
    // subpastas sem outra chamada por cada nível.
    app.state::<tauri::scope::Scopes>()
        .allow_directory(&canonical, true)
        .map_err(|e| Error::Files(format!("não deu para autorizar a pasta de música: {e}")))?;

    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| canonical.to_string_lossy().to_string());
    let canonical_path = canonical.to_string_lossy().to_string();

    let mut guard = root.inner.lock().unwrap();
    *guard = Some(canonical);

    Ok(RealMusicRoot {
        path: canonical_path,
        name,
    })
}

/// Lê os ficheiros de áudio na raiz declarada.
///
/// Só devolve ficheiros (não pastas) com extensão de áudio reconhecida, e
/// nunca sai da raiz — a mesma fronteira do Explorador real: "nunca o disco
/// todo" cumpre-se aqui, não na interface.
#[tauri::command]
pub fn music_read_dir(root: State<'_, MusicRoot>) -> Result<Vec<MusicFileEntry>> {
    let declared_root = {
        let guard = root.inner.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| Error::Files("nenhuma pasta de música escolhida ainda.".to_string()))?
    };

    let read_dir = fs::read_dir(&declared_root)
        .map_err(|e| Error::Files(format!("não consegui ler a pasta de música: {e}")))?;

    let mut entries = Vec::new();

    for item in read_dir {
        // Uma entrada individual que falha a ler não rebenta a pasta inteira.
        let Ok(item) = item else { continue };
        let Ok(metadata) = item.metadata() else { continue };

        if !metadata.is_file() {
            continue;
        }

        let path = item.path();
        let is_audio = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| {
                let lower = ext.to_ascii_lowercase();
                AUDIO_EXTENSIONS.contains(&lower.as_str())
            })
            .unwrap_or(false);

        if !is_audio {
            continue;
        }

        entries.push(MusicFileEntry {
            name: item.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
        });
    }

    Ok(entries)
}
