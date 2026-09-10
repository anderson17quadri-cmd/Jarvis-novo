use crate::error::Result;

#[cfg(target_os = "windows")]
use crate::windows_hello::VerificationOutcome;

/// `true` se este dispositivo tem o Windows Hello configurado (sensor de
/// rosto, impressão digital ou PIN). Uma máquina sem nada disso, ou fora do
/// Windows, devolve `false` — nunca um erro: é a interface quem decide cair
/// para a palavra-passe.
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_hello_available() -> Result<bool> {
    crate::windows_hello::is_available().await
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn windows_hello_available() -> Result<bool> {
    Ok(false)
}

/// Dispara o ecrã nativo do Windows Hello. `message` aparece no diálogo, a
/// explicar à pessoa porque está a ser pedida a verificação.
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_hello_verify(message: String) -> Result<String> {
    let outcome = crate::windows_hello::verify(&message).await?;
    Ok(match outcome {
        VerificationOutcome::Verified => "verified",
        VerificationOutcome::Denied => "denied",
        VerificationOutcome::Unavailable => "unavailable",
    }
    .to_owned())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn windows_hello_verify(_message: String) -> Result<String> {
    Ok("unavailable".to_owned())
}
