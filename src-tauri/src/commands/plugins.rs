use std::fs;
use std::path::PathBuf;

use crate::error::Result;

/// Lê um ficheiro de plugin (.jarvis-plugin) do disco e devolve o conteúdo
/// como uma string JSON.
///
/// O caminho é canonicalizado antes de ler — o mesmo princípio dos comandos
/// `files_set_root`/`files_read_dir`: nunca se confia num caminho que a
/// interface mandou sem o resolver primeiro.
///
/// Este comando é a única forma de um plugin externo entrar no sistema:
/// a interface abre o diálogo nativo (plugin `dialog` do Tauri), a pessoa
/// escolhe o ficheiro, e este comando lê-o. O conteúdo volta para a
/// interface, que verifica a assinatura e decide se o instala.
#[tauri::command]
pub fn read_plugin_file(path: String) -> Result<String> {
    let raw = PathBuf::from(&path);

    let canonical = raw.canonicalize().map_err(|e| {
        crate::error::Error::Files(format!(
            "o ficheiro '{path}' não existe ou não se pode ler: {e}"
        ))
    })?;

    if !canonical.is_file() {
        return Err(crate::error::Error::Files(format!(
            "'{path}' não é um ficheiro."
        )));
    }

    fs::read_to_string(&canonical).map_err(|e| {
        crate::error::Error::Files(format!(
            "não consegui ler o ficheiro '{path}': {e}"
        ))
    })
}
