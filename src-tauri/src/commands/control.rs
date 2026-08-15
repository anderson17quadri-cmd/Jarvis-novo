use std::path::{Path, PathBuf};

use crate::error::Result;

/// Abre um ficheiro ou aplicação pelo caminho, no abridor predefinido do
/// sistema — o equivalente a um duplo-clique, não a execução arbitrária.
///
/// Fase 3.2 (`docs/spec/fase-3-controlo-direto.md` §4): a ação nativa de
/// menor risco de toda a fase — não mexe no rato nem no teclado, só pede ao
/// sistema operativo que abra um caminho com a aplicação que o próprio SO
/// associa àquele tipo de ficheiro.
///
/// A porta de presença (controlo direto ligado, sessão ativa, confirmação
/// explícita) vive do lado da interface — `directControlService` — que só
/// chega a invocar isto depois de tudo confirmado. Aqui só se garante que o
/// caminho existe antes de tocar no abridor: um caminho inventado é recusado
/// sem efeito nenhum.
#[tauri::command]
pub fn open_path(path: String) -> Result<()> {
    let canonical = resolve_existing(&path)?;

    // `open::that` delega no abridor do sistema — o mesmo gesto de um
    // duplo-clique. Não é `std::process::Command`: não há como esconder um
    // executável arbitrário por trás de um caminho bonito, porque aqui só o
    // abridor associado ao tipo de ficheiro é que é invocado.
    open::that(canonical)
        .map_err(|e| crate::error::Error::Files(format!("não consegui abrir '{path}': {e}")))
}

/// Valida e normaliza um caminho para abrir: tem de existir (ficheiro ou
/// pasta). Separado de `open_path` para ser testável sem tocar no abridor do
/// sistema.
fn resolve_existing(path: &str) -> Result<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(crate::error::Error::Files("o caminho está vazio.".to_string()));
    }

    // Canonicalizar resolve "..", links simbólicos e separadores repetidos,
    // e confirma que o caminho aponta para algo que existe mesmo — antes de o
    // entregar ao abridor.
    Path::new(trimmed).canonicalize().map_err(|e| {
        crate::error::Error::Files(format!(
            "o caminho '{trimmed}' não existe ou não se pode ler: {e}"
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caminho_vazio_e_recusado() {
        assert!(resolve_existing("").is_err());
        assert!(resolve_existing("   ").is_err());
    }

    #[test]
    fn caminho_inexistente_e_recusado() {
        let inexistente = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("nao-existe-mesmo.txt");
        assert!(resolve_existing(&inexistente.to_string_lossy()).is_err());
    }

    #[test]
    fn um_ficheiro_que_existe_e_aceite() {
        // O manifesto do crate existe sempre durante os testes.
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert!(resolve_existing(&manifest.to_string_lossy()).is_ok());
    }
}
