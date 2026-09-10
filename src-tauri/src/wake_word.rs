use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};

const PORT: u16 = 8091;

pub struct WakeWordProcess(pub Mutex<Option<Child>>);

fn encontrar_pasta(base: &Path) -> Option<PathBuf> {
    [
        base.join("wake-word-service"),
        base.join("../wake-word-service"),
        base.join("../../wake-word-service"),
    ]
    .into_iter()
    .find(|pasta| pasta.join(".venv").join("Scripts").join("python.exe").is_file())
    .and_then(|pasta| pasta.canonicalize().ok())
}

fn arrancar(pasta: &Path) -> std::io::Result<Child> {
    let mut comando = Command::new(pasta.join(".venv").join("Scripts").join("python.exe"));
    comando
        .args(["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", &PORT.to_string()])
        .current_dir(pasta)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt as _;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        comando.creation_flags(CREATE_NO_WINDOW);
    }

    comando.spawn()
}

fn esperar_servico() -> bool {
    for _ in 0..20 {
        if ureq::get(&format!("http://127.0.0.1:{PORT}/health"))
            .timeout(Duration::from_millis(250))
            .call()
            .is_ok()
        {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

fn servico_a_correr() -> bool {
    ureq::get(&format!("http://127.0.0.1:{PORT}/health"))
        .timeout(Duration::from_millis(300))
        .call()
        .is_ok()
}

#[tauri::command]
pub fn iniciar_wake_word(app: AppHandle, palavra: String) -> Result<(), String> {
    if palavra.trim().is_empty() {
        return Err("a palavra de ativação não pode ficar vazia".into());
    }

    let precisa_arrancar = app
        .try_state::<WakeWordProcess>()
        .and_then(|estado| estado.0.lock().ok().map(|filho| filho.is_none()))
        .unwrap_or(true);

    if precisa_arrancar && !servico_a_correr() {
        let base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let Some(pasta) = encontrar_pasta(&base) else {
            return Err("wake-word-service não está configurado — corre wake-word-service/setup.ps1".into());
        };
        let filho = arrancar(&pasta).map_err(|erro| format!("não consegui arrancar a wake word: {erro}"))?;
        if !esperar_servico() {
            return Err("a wake word não respondeu ao arrancar".into());
        }
        if let Some(estado) = app.try_state::<WakeWordProcess>() {
            *estado.0.lock().expect("lock da wake word") = Some(filho);
        }
    }

    ureq::post(&format!("http://127.0.0.1:{PORT}/start"))
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(5))
        .send_string(&serde_json::json!({ "word": palavra }).to_string())
        .map_err(erro_do_start)?;
    Ok(())
}

/// `POST /start` recusa (503/400) com um `detail` claro quando o modelo ou o
/// microfone falham a prova a sério (`Detector.start`, em `server.py`) — sem
/// isto, o erro que chegava à interface era só "http status: 503", sem dizer
/// o que falhou de verdade.
fn erro_do_start(erro: ureq::Error) -> String {
    match erro {
        ureq::Error::Status(_, resposta) => resposta
            .into_string()
            .ok()
            .and_then(|corpo| extrair_detalhe(&corpo))
            .unwrap_or_else(|| "não consegui ligar a wake word".into()),
        ureq::Error::Transport(_) => format!("não consegui ligar a wake word: {erro}"),
    }
}

/// O `{"detail": "..."}` que o `HTTPException` do FastAPI devolve. Separado
/// de `erro_do_start` para ser testável sem um servidor a correr.
fn extrair_detalhe(corpo: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(corpo)
        .ok()?
        .get("detail")?
        .as_str()
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extrai_o_detalhe_de_um_erro_fastapi() {
        assert_eq!(
            extrair_detalhe(r#"{"detail":"sem microfone disponível para a wake word: ..."}"#),
            Some("sem microfone disponível para a wake word: ...".to_string()),
        );
    }

    #[test]
    fn sem_detalhe_devolve_none() {
        assert_eq!(extrair_detalhe(r#"{"ok":false}"#), None);
        assert_eq!(extrair_detalhe("não é json"), None);
    }
}

#[tauri::command]
pub fn parar_wake_word(app: AppHandle) {
    let _ = ureq::post(&format!("http://127.0.0.1:{PORT}/stop"))
        .timeout(Duration::from_secs(1))
        .call();
    if let Some(estado) = app.try_state::<WakeWordProcess>() {
        if let Some(mut filho) = estado.0.lock().expect("lock da wake word").take() {
            let _ = filho.kill();
        }
    }
}

pub fn cleanup(app: &AppHandle) {
    parar_wake_word(app.clone());
}
