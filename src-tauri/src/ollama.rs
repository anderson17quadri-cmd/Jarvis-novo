use std::env;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// A porta por omissão do Ollama — a mesma que `OllamaProvider` já usa do
/// lado da interface (`DEFAULT_OLLAMA_BASE_URL`).
const PORT: u16 = 11434;

/// O modelo puxado sozinho quando não há nenhum instalado ainda — pedido
/// explícito do utilizador (20/08/2026): "quero o Llama, sem precisar de
/// abrir outro programa". `3b` (não `8b`+) de propósito: a mesma máquina já
/// tem o XTTS-v2 e o Whisper carregados (ver o aviso em `AiSettings.tsx`,
/// item 27) — um modelo pequeno cabe ao lado deles sem apertar a placa, e a
/// família Llama 3.2 já está na lista de modelos capazes de pedir
/// ferramentas (`TOOL_CAPABLE_PREFIXES`, `ollama-provider.ts`).
const DEFAULT_MODEL: &str = "llama3.2:3b";

/// Um descarregamento de poucos GB pode demorar minutos numa ligação lenta —
/// generoso de propósito, mas não infinito: uma ligação real e sem resposta
/// nenhuma durante meia hora já não é "lenta", é presa.
const PULL_TIMEOUT: Duration = Duration::from_secs(30 * 60);

/// Guarda o processo filho, só quando é o JARVIS a arrancá-lo. `None` quando
/// o Ollama já estava a correr por fora — nesse caso não há nada nosso para
/// matar ao sair.
pub struct OllamaProcess(pub Mutex<Option<Child>>);

/// O que a interface recebe sobre o descarregamento automático do modelo por
/// omissão — uma só vez por arranque, quando não havia nenhum modelo.
#[derive(Clone, Serialize)]
#[serde(tag = "phase", rename_all = "lowercase")]
enum PullEvent {
    Started { model: String },
    Progress { model: String, percent: u8 },
    Done { model: String },
    Failed { model: String, error: String },
}

const PULL_EVENT_NAME: &str = "ollama://pull";

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

/// `true` se `GET /api/tags` disser que já há pelo menos um modelo
/// instalado. Separado do pedido para ser testável com um corpo qualquer.
fn ja_tem_algum_modelo(corpo: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(corpo)
        .ok()
        .and_then(|v| v.get("models")?.as_array().map(|a| !a.is_empty()))
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

/// Espera até `/api/tags` responder (arrancar o processo não o torna pronto
/// no mesmo instante) antes de perguntar por modelos.
fn esperar_servico() -> bool {
    for _ in 0..40 {
        if servico_saudavel() {
            return true;
        }
        thread::sleep(Duration::from_millis(250));
    }
    false
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
        pull_modelo_por_omissao_se_faltar(app);
        return;
    }

    match arrancar() {
        Ok(child) => {
            eprintln!("[jarvis] Ollama arrancado sozinho (PID {}).", child.id());
            if let Some(estado) = app.try_state::<OllamaProcess>() {
                *estado.0.lock().expect("lock do processo do Ollama") = Some(child);
            }
            if esperar_servico() {
                pull_modelo_por_omissao_se_faltar(app);
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

/// Se o Ollama não tiver nenhum modelo instalado, descarrega o de omissão
/// sozinho — pedido explícito do utilizador para o JARVIS ficar "inteligente
/// sem precisar de adicionar mais nada". Corre numa thread à parte: um
/// descarregamento de vários GB não pode bloquear o arranque da app, nem a
/// pergunta "já tens modelos" atrasar a app por si só.
fn pull_modelo_por_omissao_se_faltar(app: &AppHandle) {
    let ja_tem = match ureq::get(&format!("http://127.0.0.1:{PORT}/api/tags"))
        .timeout(Duration::from_secs(3))
        .call()
    {
        Ok(resposta) if resposta.status() == 200 => {
            ja_tem_algum_modelo(&resposta.into_string().unwrap_or_default())
        }
        // Sem resposta clara — não se arrisca um descarregamento às cegas.
        _ => return,
    };

    if ja_tem {
        return;
    }

    let app = app.clone();
    thread::spawn(move || puxar_modelo(&app, DEFAULT_MODEL));
}

/// O descarregamento em si — `POST /api/pull` do Ollama, em streaming: cada
/// linha do corpo é um objeto JSON com o progresso (`total`/`completed` em
/// bytes) até `{"status":"success"}` no fim. Emite `ollama://pull` à
/// interface em cada fase, para a pessoa ver que está a acontecer e não achar
/// que a app ficou presa.
fn puxar_modelo(app: &AppHandle, modelo: &str) {
    let _ = app.emit(PULL_EVENT_NAME, PullEvent::Started { model: modelo.to_string() });

    match executar_pull(app, modelo) {
        Ok(()) => {
            eprintln!("[jarvis] modelo Ollama '{modelo}' pronto.");
            let _ = app.emit(PULL_EVENT_NAME, PullEvent::Done { model: modelo.to_string() });
        }
        Err(erro) => {
            eprintln!("[jarvis] não consegui descarregar o modelo Ollama '{modelo}': {erro}");
            let _ = app.emit(
                PULL_EVENT_NAME,
                PullEvent::Failed { model: modelo.to_string(), error: erro },
            );
        }
    }
}

fn executar_pull(app: &AppHandle, modelo: &str) -> std::result::Result<(), String> {
    let corpo = serde_json::json!({ "model": modelo, "stream": true }).to_string();
    let resposta = ureq::post(&format!("http://127.0.0.1:{PORT}/api/pull"))
        .set("Content-Type", "application/json")
        .timeout(PULL_TIMEOUT)
        .send_string(&corpo)
        .map_err(|e| e.to_string())?;

    let leitor = BufReader::new(resposta.into_reader());
    let mut ultimo_percent: Option<u8> = None;
    let mut linhas = Vec::new();

    for linha in leitor.lines() {
        let linha = linha.map_err(|e| e.to_string())?;
        if linha.trim().is_empty() {
            continue;
        }

        let Ok(valor) = serde_json::from_str::<serde_json::Value>(&linha) else {
            continue;
        };

        let interpretada = interpretar_linha(&valor);
        if let LinhaPull::Progresso(percent) = interpretada {
            if ultimo_percent != Some(percent) {
                ultimo_percent = Some(percent);
                let _ = app.emit(
                    PULL_EVENT_NAME,
                    PullEvent::Progress { model: modelo.to_string(), percent },
                );
            }
        }
        linhas.push(interpretada);
    }

    resultado_do_pull(&linhas)
}

/// O que uma linha do streaming de `/api/pull` diz — separado do pedido em
/// si para ser testável sem rede nenhuma.
enum LinhaPull {
    Erro(String),
    Progresso(u8),
    Sucesso,
    Ignorar,
}

fn interpretar_linha(valor: &serde_json::Value) -> LinhaPull {
    if let Some(erro) = valor.get("error").and_then(|e| e.as_str()) {
        return LinhaPull::Erro(erro.to_string());
    }
    if valor.get("status").and_then(|s| s.as_str()) == Some("success") {
        return LinhaPull::Sucesso;
    }
    match progresso_de(valor) {
        Some(percent) => LinhaPull::Progresso(percent),
        None => LinhaPull::Ignorar,
    }
}

/// Decide o resultado final de um pull a partir das linhas já interpretadas
/// — só conta como concluído quando viu `{"status":"success"}` explícito,
/// **nunca só porque o stream acabou sem `{"error":...}`**. Sem esta
/// confirmação, uma ligação fechada limpa a meio (o Ollama crasha, um proxy
/// corta a ligação sem quebrar o HTTP a meio de um `chunk`) passava por
/// sucesso na mesma — a interface chegava a mostrar "JARVIS está pronto"
/// com um modelo que nunca ficou instalado. Separado do pedido para ser
/// testável sem rede nenhuma.
fn resultado_do_pull(linhas: &[LinhaPull]) -> std::result::Result<(), String> {
    for linha in linhas {
        if let LinhaPull::Erro(erro) = linha {
            return Err(erro.clone());
        }
    }
    if linhas.iter().any(|linha| matches!(linha, LinhaPull::Sucesso)) {
        Ok(())
    } else {
        Err("o Ollama fechou a ligação sem confirmar que o modelo ficou pronto".to_string())
    }
}

/// Calcula a percentagem de uma linha de progresso do `/api/pull`
/// (`{"total": N, "completed": M}`, em bytes). `None` quando a linha não traz
/// os dois campos (mensagens de estado sem números, ex.: "pulling manifest").
/// Separado do pedido para ser testável sem rede nenhuma.
fn progresso_de(valor: &serde_json::Value) -> Option<u8> {
    let total = valor.get("total")?.as_u64()?;
    let completed = valor.get("completed")?.as_u64()?;
    if total == 0 {
        return None;
    }
    Some(((completed.saturating_mul(100)) / total).min(100) as u8)
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

    #[test]
    fn deteta_se_ja_ha_modelo_instalado() {
        assert!(!ja_tem_algum_modelo(r#"{"models":[]}"#));
        assert!(ja_tem_algum_modelo(r#"{"models":[{"name":"llama3.2:3b"}]}"#));
        // Corpo ilegível — não se arrisca a assumir que já tem, mas
        // `pull_modelo_por_omissao_se_faltar` só chega aqui depois de um
        // 200 a sério, por isso este caso é só defesa extra.
        assert!(!ja_tem_algum_modelo("não é json"));
        assert!(!ja_tem_algum_modelo(""));
    }

    #[test]
    fn calcula_a_percentagem_do_progresso() {
        let linha = serde_json::json!({ "status": "downloading", "total": 200, "completed": 50 });
        assert_eq!(progresso_de(&linha), Some(25));

        let completo = serde_json::json!({ "total": 100, "completed": 100 });
        assert_eq!(progresso_de(&completo), Some(100));
    }

    #[test]
    fn uma_linha_de_estado_sem_numeros_nao_da_percentagem() {
        let linha = serde_json::json!({ "status": "pulling manifest" });
        assert_eq!(progresso_de(&linha), None);
    }

    #[test]
    fn total_zero_nao_divide_por_zero() {
        let linha = serde_json::json!({ "total": 0, "completed": 0 });
        assert_eq!(progresso_de(&linha), None);
    }

    #[test]
    fn interpreta_cada_forma_de_linha_do_pull() {
        let erro = serde_json::json!({ "error": "modelo desconhecido" });
        assert!(matches!(interpretar_linha(&erro), LinhaPull::Erro(e) if e == "modelo desconhecido"));

        let sucesso = serde_json::json!({ "status": "success" });
        assert!(matches!(interpretar_linha(&sucesso), LinhaPull::Sucesso));

        let progresso = serde_json::json!({ "total": 100, "completed": 50 });
        assert!(matches!(interpretar_linha(&progresso), LinhaPull::Progresso(50)));

        let estado_sem_numeros = serde_json::json!({ "status": "pulling manifest" });
        assert!(matches!(interpretar_linha(&estado_sem_numeros), LinhaPull::Ignorar));
    }

    #[test]
    fn um_stream_que_acaba_sem_confirmar_sucesso_e_uma_falha() {
        // O caso que passava por "pronto" antes desta correção: o stream
        // fecha (sem exceção de leitura, sem `{"error":...}`) mas nunca
        // chegou a mandar `{"status":"success"}` — uma ligação cortada a
        // meio do descarregamento, por exemplo.
        let linhas = vec![LinhaPull::Progresso(10), LinhaPull::Progresso(50)];
        assert_eq!(
            resultado_do_pull(&linhas),
            Err("o Ollama fechou a ligação sem confirmar que o modelo ficou pronto".to_string())
        );
    }

    #[test]
    fn um_stream_com_a_confirmacao_de_sucesso_e_um_sucesso() {
        let linhas = vec![LinhaPull::Progresso(10), LinhaPull::Progresso(100), LinhaPull::Sucesso];
        assert_eq!(resultado_do_pull(&linhas), Ok(()));
    }

    #[test]
    fn um_erro_a_meio_do_stream_conta_mesmo_com_sucesso_a_seguir() {
        // Não deve acontecer na prática (o Ollama não manda mais nada depois
        // de um erro), mas a decisão não deve depender dessa suposição.
        let linhas = vec![LinhaPull::Erro("sem espaço em disco".to_string()), LinhaPull::Sucesso];
        assert_eq!(resultado_do_pull(&linhas), Err("sem espaço em disco".to_string()));
    }
}
