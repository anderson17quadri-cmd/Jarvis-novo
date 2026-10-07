use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn configured_dir(root: &Path, name: &str) -> Option<PathBuf> {
    let path = root.join("services").join(name);
    if path.join("server.py").is_file() && path.join(".venv/Scripts/python.exe").is_file() {
        path.canonicalize().ok()
    } else { None }
}

/// As dependências grandes ficam numa pasta gravável do utilizador, fora do instalador.
pub fn find_installed(app: &AppHandle, name: &str) -> Option<PathBuf> {
    configured_dir(&app.path().app_local_data_dir().ok()?, name)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_installation_is_not_reported_as_ready() {
        assert!(configured_dir(Path::new("."), "servico-inexistente").is_none());
    }
}
