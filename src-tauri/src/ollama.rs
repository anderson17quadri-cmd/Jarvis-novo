use std::env;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};

/// A porta por omissão do Ollama — a mesma que `OllamaProvider` já usa do
/// lado da interface (`DEFAULT_OLLAMA_BASE_URL`).
const PORT: u16 = 11434;

/// Guarda o processo filho, só quando é o JARVIS a arrancá-lo. `None` quando
/// o Ollama já estava a correr por fora — nesse caso não há nada nosso para
/// matar ao sair.
pub struct OllamaProcess(pub Mutex<Option<Child>>);

/// Há um Ollama a responder, saudável, na porta de sempre. `GET /api/tags` é
/// o endpoint do próprio Ollama para listar modelos — específico dele, não
/// um "a porta abre" genérico: confirma-se a forma do corpo (um campo
/// `models`, mesmo que a lista venha vazia), a lição do item 19 (um órfão
/// preso a responder ao TCP mas sem falar o protocolo certo não conta).
fn servico_saudavel() -> bool {
    let corpo = match ureq::get(&format!("http://127.0.0.1:{PORT}/api/tags"))
        .timeout(Duration::from_secs(2))
        .call()
    {
        Ok(resposta) if resposta.status() == 200 => resposta.into_string().unwrap_or_default(),
        _ => return false,
    };
    e_o_ollama(&corpo)
}

/// Separado do pedido em si para ser testável sem um servidor a correr.
fn e_o_ollama(corpo: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(corpo)
        .map(|v| v.get("models").is_some())
        .unwrap_or(false)
}

/// Onde procurar o executável, por ordem: primeiro `ollama` tal como o PATH
/// o resolver (o caminho normal — o instalador do Ollama já o põe lá), depois
/// o sítio onde o instalador do Windows o costuma pôr, para quando esta app
/// arrancou antes de uma alteração de PATH se propagar ao processo.
fn candidatos_executavel() -> Vec<PathBuf> {
    let mut candidatos = vec![PathBuf::from("ollama")];
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        candidatos.push(
            Path::new(&local_app_data)
                .join("Programs")
                .join("Ollama")
                .join("ollama.exe"),
        );
    }
    candidatos
}

fn arrancar() -> std::io::Result<Child> {
    let mut ultimo_erro = None;

    for executavel in candidatos_executavel() {
        let mut comando = Command::new(&executavel);
        comando.arg("serve").stdout(Stdio::null()).stderr(Stdio::null());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt as _;
            // Sem isto, arrancar a app abria também uma janela de consola
            // preta atrás dela — o `ollama serve` não sabe que devia ficar
            // escondido.
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            comando.creation_flags(CREATE_NO_WINDOW);
        }

        match comando.spawn() {
            Ok(child) => return Ok(child),
            Err(erro) => ultimo_erro = Some(erro),
        }
    }

    Err(ultimo_erro
        .unwrap_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "ollama não encontrado")))
}

/// Arranca o Ollama sozinho, se não houver já ninguém a responder.
///
/// **Diferença de propósito face à voz clonada** (`voice_clone.rs`): o
/// Ollama pode já ser um serviço do próprio sistema, instalado e gerido pela
/// pessoa (a app de bandeja do Ollama arranca-o sozinha no login, na
/// instalação normal). Por isso não há aqui nenhum "matar o que estiver na
/// porta" — só se arranca quando a porta está mesmo livre, e nunca se toca
/// no que já lá estava.
pub fn setup(app: &AppHandle) {
    if servico_saudavel() {
        eprintln!("[jarvis] Ollama já está a correr — não arranco outro.");
        return;
    }

    match arrancar() {
        Ok(child) => {
            eprintln!("[jarvis] Ollama arrancado sozinho (PID {}).", child.id());
            if let Some(estado) = app.try_state::<OllamaProcess>() {
                *estado.0.lock().expect("lock do processo do Ollama") = Some(child);
            }
        }
        Err(err) => {
            eprintln!(
                "[jarvis] não consegui arrancar o Ollama sozinho ({err}) — fica desligado até \
                 se instalar (https://ollama.com) ou arrancar à mão."
            );
        }
    }
}

/// Mata só o processo que o JARVIS arrancou — nunca um Ollama que já
/// estivesse a correr por fora antes, porque pode ser o serviço do sistema
/// que a pessoa quer vivo depois de a app fechar.
pub fn cleanup(app: &AppHandle) {
    let Some(estado) = app.try_state::<OllamaProcess>() else { return };
    let filho = estado.0.lock().expect("lock do processo do Ollama").take();
    if let Some(mut child) = filho {
        let _ = child.kill();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconhece_a_resposta_do_ollama() {
        assert!(e_o_ollama(r#"{"models":[]}"#));
        assert!(e_o_ollama(r#"{"models":[{"name":"qwen3:8b"}]}"#));
        assert!(!e_o_ollama(r#"{"ok":true}"#));
        assert!(!e_o_ollama("não é json"));
        assert!(!e_o_ollama(""));
    }

    #[test]
    fn o_primeiro_candidato_e_sempre_o_path() {
        assert_eq!(candidatos_executavel()[0], PathBuf::from("ollama"));
    }
}
