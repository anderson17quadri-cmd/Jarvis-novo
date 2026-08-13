use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;

use crate::error::{Error, Result};

/// A pasta do vault Obsidian declarada (Peça 17).
///
/// Mesmo desenho do Explorador real (`FilesRoot`) e da Música
/// (`MusicRoot`) — estado próprio, não partilhado com nenhum dos dois, para
/// escolher um vault nunca acoplar a escolher uma pasta de música ou
/// navegar no Explorador. A raiz só muda por `obsidian_set_root`.
pub struct ObsidianRoot {
    inner: Mutex<Option<PathBuf>>,
}

impl ObsidianRoot {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl Default for ObsidianRoot {
    fn default() -> Self {
        Self::new()
    }
}

/// A pasta do vault, depois de declarada.
#[derive(Clone, Serialize)]
pub struct RealObsidianRoot {
    path: String,
    name: String,
}

/// Uma nota `.md` real, para a interface.
///
/// `path` é sempre **relativo** à raiz do vault — nunca o caminho absoluto
/// do disco. É esse caminho relativo que `obsidian_read_note` e
/// `obsidian_write_note` recebem de volta, o que evita a interface (ou o
/// modelo de IA por trás dela) ter de lidar com caminhos absolutos e reduz
/// o que há para verificar: um caminho relativo com `..` é recusado antes
/// de qualquer leitura de disco, sem depender só de `canonicalize`.
#[derive(Clone, Serialize)]
pub struct ObsidianNoteEntry {
    /// Caminho relativo à raiz, com `/` mesmo no Windows — mais simples de
    /// mostrar e de a interface reconstruir do que `PathBuf` nativo.
    path: String,
    /// Nome do ficheiro sem a extensão `.md`.
    title: String,
    #[serde(rename = "modifiedAt")]
    modified_at: i64,
}

/// Declara a pasta do vault Obsidian. Substitui qualquer raiz anterior.
#[tauri::command]
pub fn obsidian_set_root(root: State<'_, ObsidianRoot>, path: String) -> Result<RealObsidianRoot> {
    let canonical = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| Error::Files(format!("a pasta '{path}' não existe ou não se pode ler: {e}")))?;

    if !canonical.is_dir() {
        return Err(Error::Files(format!("'{path}' não é uma pasta.")));
    }

    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| canonical.to_string_lossy().to_string());
    let canonical_path = canonical.to_string_lossy().to_string();

    let mut guard = root.inner.lock().unwrap();
    *guard = Some(canonical);

    Ok(RealObsidianRoot {
        path: canonical_path,
        name,
    })
}

/// Lista todas as notas `.md` do vault, recursivamente.
///
/// Ao contrário da música (uma pasta só, sem descer) — um vault organiza-se
/// em subpastas, e listar só o topo deixaria a maior parte das notas
/// invisível. Profundidade limitada a 12 níveis: suficiente para qualquer
/// organização real, e uma rede de segurança contra um link simbólico que
/// aponte para dentro de si próprio (`canonicalize`, mais abaixo, já
/// resolveria o link antes de aqui chegar — isto é só uma segunda rede).
#[tauri::command]
pub fn obsidian_list_notes(root: State<'_, ObsidianRoot>) -> Result<Vec<ObsidianNoteEntry>> {
    let declared_root = {
        let guard = root.inner.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| Error::Files("nenhum vault Obsidian escolhido ainda.".to_string()))?
    };

    let mut entries = Vec::new();
    walk_notes(&declared_root, &declared_root, 0, &mut entries)?;
    Ok(entries)
}

const MAX_DEPTH: u8 = 12;

fn walk_notes(
    root: &Path,
    dir: &Path,
    depth: u8,
    out: &mut Vec<ObsidianNoteEntry>,
) -> Result<()> {
    if depth > MAX_DEPTH {
        return Ok(());
    }

    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        // Uma subpasta que falhe a ler (permissão, apagada a meio) não
        // rebenta a listagem inteira — só fica de fora.
        Err(_) => return Ok(()),
    };

    for item in read_dir {
        let Ok(item) = item else { continue };
        let Ok(metadata) = item.metadata() else { continue };
        let item_path = item.path();

        // Pastas ocultas do próprio Obsidian (`.obsidian`, config e plugins)
        // nunca são notas — descer lá dentro só acrescentaria ruído.
        if metadata.is_dir() {
            let hidden = item
                .file_name()
                .to_str()
                .map(|n| n.starts_with('.'))
                .unwrap_or(false);
            if hidden {
                continue;
            }
            walk_notes(root, &item_path, depth + 1, out)?;
            continue;
        }

        let is_markdown = item_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("md"))
            .unwrap_or(false);
        if !is_markdown {
            continue;
        }

        let relative = item_path
            .strip_prefix(root)
            .unwrap_or(&item_path)
            .to_string_lossy()
            .replace('\\', "/");

        let title = item_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| relative.clone());

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0);

        out.push(ObsidianNoteEntry {
            path: relative,
            title,
            modified_at,
        });
    }

    Ok(())
}

/// Resolve um caminho relativo dentro da raiz, recusando qualquer tentativa
/// de sair dela — `..`, uma raiz absoluta (`C:\`, `/`) ou um prefixo de
/// unidade diferente contam todos como fora, e são recusados aqui, antes de
/// qualquer chamada ao sistema de ficheiros.
fn resolve_within_root(root: &Path, relative: &str) -> Result<PathBuf> {
    let relative_path = Path::new(relative);

    for component in relative_path.components() {
        match component {
            Component::Normal(_) => {}
            _ => {
                return Err(Error::Files(format!(
                    "caminho de nota inválido: '{relative}'"
                )));
            }
        }
    }

    Ok(root.join(relative_path))
}

/// Lê o conteúdo de uma nota. `path` é relativo à raiz do vault.
#[tauri::command]
pub fn obsidian_read_note(root: State<'_, ObsidianRoot>, path: String) -> Result<String> {
    let declared_root = {
        let guard = root.inner.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| Error::Files("nenhum vault Obsidian escolhido ainda.".to_string()))?
    };

    let target = resolve_within_root(&declared_root, &path)?;

    let canonical_target = target
        .canonicalize()
        .map_err(|e| Error::Files(format!("a nota '{path}' não existe ou não se pode ler: {e}")))?;

    if !canonical_target.starts_with(&declared_root) {
        return Err(Error::Files("fora do vault escolhido — recusado.".to_string()));
    }

    fs::read_to_string(&canonical_target)
        .map_err(|e| Error::Files(format!("não consegui ler a nota: {e}")))
}

/// Cria ou substitui uma nota. `path` é relativo à raiz do vault; as pastas
/// intermédias são criadas se ainda não existirem (um vault organiza-se em
/// subpastas, e Notas do Chat/2026-08-13.md é um caminho normal de se
/// pedir) — mas sempre dentro da raiz, nunca fora dela.
#[tauri::command]
pub fn obsidian_write_note(
    root: State<'_, ObsidianRoot>,
    path: String,
    content: String,
) -> Result<()> {
    let declared_root = {
        let guard = root.inner.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| Error::Files("nenhum vault Obsidian escolhido ainda.".to_string()))?
    };

    let target = resolve_within_root(&declared_root, &path)?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| Error::Files(format!("não consegui preparar a pasta da nota: {e}")))?;
    }

    // A verificação de fronteira definitiva, depois de as pastas existirem:
    // `canonicalize` só funciona em caminhos que já existem, por isso corre
    // aqui, no pai (que acabou de se garantir que existe), não no ficheiro
    // final (que pode ainda não existir na primeira escrita).
    let canonical_parent = target
        .parent()
        .unwrap_or(&declared_root)
        .canonicalize()
        .map_err(|e| Error::Files(format!("não consegui confirmar a pasta da nota: {e}")))?;

    if !canonical_parent.starts_with(&declared_root) {
        return Err(Error::Files("fora do vault escolhido — recusado.".to_string()));
    }

    fs::write(&target, content).map_err(|e| Error::Files(format!("não consegui guardar a nota: {e}")))
}
