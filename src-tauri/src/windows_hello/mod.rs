//! Windows Hello a sério (Parte 5 §Biometria), via WinRT.
//!
//! Só compila em `target_os = "windows"` — `UserConsentVerifier` não existe
//! no Linux nem no macOS. `commands::windows_hello` é quem dá a cada
//! plataforma desktop a mesma assinatura de comando (ver esse ficheiro para
//! o que acontece fora do Windows).

use windows::core::HSTRING;
use windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};

use crate::error::{Error, Result};

/// Resultado simplificado para a interface.
///
/// A WinRT distingue `DeviceBusy`, `RetriesExhausted` e `Canceled` — aqui
/// contam todos como `Denied`: a pessoa não ficou verificada, e a razão
/// exata não muda o que a interface faz a seguir (cai para a palavra-passe).
/// Só a falta de sensor/configuração é `Unavailable`, porque nesse caso vale
/// a pena nem mostrar a opção da próxima vez.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationOutcome {
    Verified,
    Denied,
    Unavailable,
}

pub async fn is_available() -> Result<bool> {
    let availability = UserConsentVerifier::CheckAvailabilityAsync()
        .map_err(map_err)?
        .await
        .map_err(map_err)?;

    Ok(availability == UserConsentVerifierAvailability::Available)
}

/// Pede a verificação a sério — dispara o ecrã nativo do Windows Hello
/// (rosto, impressão digital ou PIN, conforme o que estiver configurado).
pub async fn verify(message: &str) -> Result<VerificationOutcome> {
    let h = HSTRING::from(message);
    let result = UserConsentVerifier::RequestVerificationAsync(&h)
        .map_err(map_err)?
        .await
        .map_err(map_err)?;

    Ok(match result {
        UserConsentVerificationResult::Verified => VerificationOutcome::Verified,
        UserConsentVerificationResult::DeviceNotPresent
        | UserConsentVerificationResult::NotConfiguredForUser
        | UserConsentVerificationResult::DisabledByPolicy => VerificationOutcome::Unavailable,
        _ => VerificationOutcome::Denied,
    })
}

fn map_err(err: windows::core::Error) -> Error {
    Error::Biometrics(format!("Windows Hello: {err}"))
}
