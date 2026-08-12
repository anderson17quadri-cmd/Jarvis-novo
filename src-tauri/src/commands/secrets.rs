use crate::error::Result;

/// Serviço que identifica a aplicação no Gestor de Credenciais do Windows.
const SERVICE_NAME: &str = "jarvis-ai-os";

/// Guarda um segredo no chaveiro do sistema.
///
/// No Windows escreve no Credential Manager, visível em
/// Painel de Controlo → Gestor de Credenciais → Credenciais Genéricas.
#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<()> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key)
        .map_err(|e| crate::error::Error::SystemRead(format!("não deu para abrir o cofre: {e}")))?;
    entry
        .set_password(&value)
        .map_err(|e| crate::error::Error::SystemRead(format!("não deu para guardar no cofre: {e}")))?;
    Ok(())
}

/// Lê um segredo do chaveiro. `None` se não existir.
#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key)
        .map_err(|e| crate::error::Error::SystemRead(format!("não deu para abrir o cofre: {e}")))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(crate::error::Error::SystemRead(format!(
            "não deu para ler do cofre: {e}"
        ))),
    }
}

/// Apaga um segredo do chaveiro. Se já não existia, não é erro.
#[tauri::command]
pub fn secret_delete(key: String) -> Result<()> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key)
        .map_err(|e| crate::error::Error::SystemRead(format!("não deu para abrir o cofre: {e}")))?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(crate::error::Error::SystemRead(format!(
            "não deu para apagar do cofre: {e}"
        ))),
    }
}
