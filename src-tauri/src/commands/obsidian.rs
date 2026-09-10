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

    read_note_within(&declared_root, &path)
}

/// A lógica de `obsidian_read_note`, sem o `State` do Tauri — para poder
/// ser testada com uma pasta temporária a sério, sem precisar de uma app
/// Tauri a correr.
fn read_note_within(declared_root: &Path, path: &str) -> Result<String> {
    let target = resolve_within_root(declared_root, path)?;

    let canonical_target = target
        .canonicalize()
        .map_err(|e| Error::Files(format!("a nota '{path}' não existe ou não se pode ler: {e}")))?;

    if !canonical_target.starts_with(declared_root) {
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

    write_note_within(&declared_root, &path, &content)
}

/// A lógica de `obsidian_write_note`, sem o `State` do Tauri — mesmo motivo
/// de `read_note_within`.
fn write_note_within(declared_root: &Path, path: &str, content: &str) -> Result<()> {
    let target = resolve_within_root(declared_root, path)?;

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
        .unwrap_or(declared_root)
        .canonicalize()
        .map_err(|e| Error::Files(format!("não consegui confirmar a pasta da nota: {e}")))?;

    if !canonical_parent.starts_with(declared_root) {
        return Err(Error::Files("fora do vault escolhido — recusado.".to_string()));
    }

    // A pasta está confirmada dentro do vault — mas se `target` já existir
    // e for **ele próprio** um link simbólico, escrever nele segue o link
    // (é assim que `fs::write`/`CreateFile` funcionam) e pode acabar em
    // qualquer sítio do disco que a pessoa tenha permissão de escrita,
    // fora do vault, sem que a verificação acima (que só olha para a
    // pasta-mãe, nunca para o ficheiro final) alguma vez dê por isso.
    // `symlink_metadata` não segue o link — é o que permite detetá-lo antes
    // de escrever, em vez de descobrir depois de já ter escrito no sítio
    // errado.
    if let Ok(metadata) = fs::symlink_metadata(&target) {
        if metadata.file_type().is_symlink() {
            return Err(Error::Files(
                "essa nota é um link simbólico — recusado, por segurança.".to_string(),
            ));
        }
    }

    fs::write(&target, content).map_err(|e| Error::Files(format!("não consegui guardar a nota: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Uma pasta temporária a sério, apagada sozinha ao sair de âmbito —
    /// sem puxar o crate `tempfile` só para isto, que já não estava nas
    /// dependências.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(nome: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "jarvis-obsidian-teste-{nome}-{}",
                std::process::id()
            ));
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

    #[test]
    fn escreve_e_relê_uma_nota_normal() {
        let vault = TempDir::new("normal");
        write_note_within(&vault.path(), "nota.md", "conteúdo real").unwrap();

        assert_eq!(read_note_within(&vault.path(), "nota.md").unwrap(), "conteúdo real");
    }

    #[test]
    fn cria_subpastas_intermedias_ao_escrever() {
        let vault = TempDir::new("subpastas");
        write_note_within(&vault.path(), "Notas do Chat/2026-08-13.md", "olá").unwrap();

        assert_eq!(
            read_note_within(&vault.path(), "Notas do Chat/2026-08-13.md").unwrap(),
            "olá"
        );
    }

    #[test]
    fn caminho_com_ponto_ponto_e_recusado_antes_de_tocar_no_disco() {
        let vault = TempDir::new("dotdot");

        assert!(write_note_within(&vault.path(), "../fora.md", "x").is_err());
        assert!(read_note_within(&vault.path(), "../fora.md").is_err());
        // Confirma que não escreveu mesmo nada lá fora.
        assert!(!vault.path().parent().unwrap().join("fora.md").exists());
    }

    #[test]
    fn caminho_absoluto_e_recusado() {
        let vault = TempDir::new("absoluto");
        let alvo = if cfg!(windows) { "C:\\Windows\\evil.md" } else { "/etc/evil.md" };

        assert!(write_note_within(&vault.path(), alvo, "x").is_err());
    }

    /// Achado numa revisão de segurança a sério (13/08/2026): a verificação
    /// de fronteira de `obsidian_write_note` só canonicalizava a
    /// pasta-mãe, nunca o ficheiro final — um link simbólico já existente
    /// com o nome da nota (a apontar para fora do vault) escrevia através
    /// dele sem ninguém dar por isso. Só corre em Unix: criar um link
    /// simbólico no Windows por omissão pede um privilégio que a maioria
    /// das contas não tem, e a lógica corrigida é a mesma nos dois SOs.
    #[cfg(unix)]
    #[test]
    fn recusa_escrever_atraves_de_um_link_simbolico_ja_existente() {
        use std::os::unix::fs::symlink;

        let vault = TempDir::new("symlink-write");
        let fora = TempDir::new("symlink-alvo");
        let alvo_real = fora.path().join("segredo.txt");
        fs::write(&alvo_real, "não mexer").unwrap();

        symlink(&alvo_real, vault.path().join("nota.md")).unwrap();

        let resultado = write_note_within(&vault.path(), "nota.md", "conteúdo do atacante");
        assert!(resultado.is_err());

        // O ficheiro fora do vault não foi tocado.
        assert_eq!(fs::read_to_string(&alvo_real).unwrap(), "não mexer");
    }

    /// A mesma proteção do lado da leitura já existia (`canonicalize` do
    /// próprio ficheiro, não só da pasta) — este teste prova que continua a
    /// funcionar, não é uma correção nova.
    #[cfg(unix)]
    #[test]
    fn recusa_ler_atraves_de_um_link_simbolico_para_fora() {
        use std::os::unix::fs::symlink;

        let vault = TempDir::new("symlink-read");
        let fora = TempDir::new("symlink-alvo-leitura");
        let alvo_real = fora.path().join("segredo.txt");
        fs::write(&alvo_real, "conteúdo privado").unwrap();

        symlink(&alvo_real, vault.path().join("nota.md")).unwrap();

        assert!(read_note_within(&vault.path(), "nota.md").is_err());
    }
}
