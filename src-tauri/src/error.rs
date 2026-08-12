use serde::Serialize;

/// Erro único de todos os comandos.
///
/// Regra do projeto: nenhum comando faz `unwrap()`. Tudo o que pode falhar
/// devolve `Result<T, Error>` e chega à interface como uma string legível, que
/// o `PlatformAdapter` transforma numa degradação suave em vez de um crash.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Só é construído em alvos móveis (ver `commands::system::get_top_processes`),
    /// por isso no desktop parece código morto — e não é.
    #[cfg_attr(desktop, allow(dead_code))]
    #[error("métrica indisponível nesta plataforma: {0}")]
    Unsupported(String),

    #[error("falha ao ler o estado do sistema: {0}")]
    SystemRead(String),

    #[cfg_attr(any(mobile, target_os = "android", target_os = "ios"), allow(dead_code))]
    #[error("sessão de terminal desconhecida: {0}")]
    UnknownSession(String),

    #[cfg_attr(any(mobile, target_os = "android", target_os = "ios"), allow(dead_code))]
    #[error("falha no terminal: {0}")]
    Terminal(String),

    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    #[error("falha na biometria: {0}")]
    Biometrics(String),

    #[cfg_attr(any(mobile, target_os = "android", target_os = "ios"), allow(dead_code))]
    #[error("erro no sistema de ficheiros: {0}")]
    Files(String),

    #[error("erro do Tauri: {0}")]
    Tauri(#[from] tauri::Error),
}

/// O `Result` do IPC do Tauri exige `Serialize` no erro.
impl Serialize for Error {
    // `std::result::Result` explícito: o alias `Result<T>` deste módulo só tem
    // um parâmetro e sombrearia a assinatura exigida pelo trait.
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
