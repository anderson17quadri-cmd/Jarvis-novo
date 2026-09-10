use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};

/// A porta fixa do serviço — ver `voice-clone-service/server.py`.
const PORT: u16 = 8090;

/// Guarda o processo filho, para o poder matar ao sair (`cleanup`). `None`
/// até se tentar arrancar, ou se não houver nada para arrancar aqui.
pub struct VoiceCloneProcess(pub Mutex<Option<Child>>);

/// Há um serviço de voz a responder, saudável, na porta do serviço. Confirma
/// primeiro com `GET /health` — não basta a porta estar aberta: um `uvicorn`
/// morto a meio (a tentar ligar, por exemplo) ou um processo estranho qualquer
/// a ocupar a porta abririam a ligação TCP mas não falam o nosso protocolo, e
/// a app ficava calada na mesma.
///
/// Mas o `ok` do `/health` é hardcoded (`server.py` devolve sempre `"ok": True`),
/// por isso não chega: um órfão preso a responder — com o contexto CUDA
/// envenenado por um reset da GPU, por exemplo — continua a dizer `ok:true` mas
/// falha o `/falar`. Por isso, se a porta responder, prova-se a sério com uma
/// síntese mínima (`consegue_sintetizar`) antes de se aceitar o serviço como bom.
fn servico_saudavel() -> bool {
    let corpo = match ureq::get(&format!("http://127.0.0.1:{PORT}/health"))
        .timeout(Duration::from_secs(2))
        .call()
    {
        Ok(resposta) if resposta.status() == 200 => resposta.into_string().unwrap_or_default(),
        _ => return false,
    };
    saude_ok(&corpo) && consegue_sintetizar()
}

/// O corpo de `GET /health` diz que está tudo bem (`ok: true`). Separado do
/// pedido em si para ser testável sem um servidor a correr.
fn saude_ok(corpo: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(corpo)
        .map(|v| v.get("ok").and_then(|ok| ok.as_bool()).unwrap_or(false))
        .unwrap_or(false)
}

/// A prova a sério de que o serviço ainda sintetiza: manda `POST /falar` com
/// uma palavra mínima e uma voz pronta do modelo (não a clonada — essa pode
/// nem existir ainda) e confirma que volta áudio WAV. É o que distingue um
/// serviço bom de um órfão que ainda responde ao `/health` mas já não
/// consegue gerar áudio.
fn consegue_sintetizar() -> bool {
    let resposta = match ureq::post(&format!("http://127.0.0.1:{PORT}/falar"))
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(15))
        .send_bytes(br#"{"texto":"a","voz":"Ana Florence"}"#)
    {
        Ok(resposta) if resposta.status() == 200 => resposta,
        _ => return false,
    };
    let mut bytes = Vec::new();
    if resposta.into_reader().read_to_end(&mut bytes).is_err() {
        return false;
    }
    e_wav(&bytes)
}

/// O corpo devolvido é um WAV a sério (cabeçalho `RIFF`…`WAVE`), não um JSON
/// de erro disfarçado de resposta boa. Separado do pedido para ser testável.
fn e_wav(bytes: &[u8]) -> bool {
    bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WAVE"
}

/// Mata um `uvicorn server:app` nosso que esteja preso a ocupar a porta. Só
/// o nosso serviço — identificado pela linha de comando, não pela porta:
/// matar o que quer que esteja na 8090 podia levar um processo de outra
/// pessoa à frente. Sem nada que bata certo, não faz nada.
fn matar_servico_preso() {
    let mut sistema = sysinfo::System::new();
    sistema.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for processo in sistema.processes().values() {
        let linha = processo
            .cmd()
            .iter()
            .map(|s| s.to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(" ");
        if e_o_nosso_servico(&linha) {
            processo.kill();
        }
    }
}

/// A linha de comando é a do nosso serviço (`python -m uvicorn server:app`).
/// Separado da matança para ser testável.
fn e_o_nosso_servico(linha_de_comando: &str) -> bool {
    linha_de_comando.contains("uvicorn")
        && linha_de_comando.contains("server:app")
        && linha_de_comando.contains("8090")
}

/// Onde `voice-clone-service/` deve estar — só faz sentido em
/// desenvolvimento, a correr a partir do código-fonte nesta máquina: o
/// `.venv` (mais de 2 GB, com o PyTorch) não viaja com um build instalado.
/// Tenta um punhado de sítios prováveis a partir de `base` (o diretório de
/// trabalho do processo, que muda consoante se corre via `cargo run`/`tauri
/// dev` ou o executável já compilado), e desiste em silêncio se não
/// encontrar nenhum — arrancar sem o serviço de voz é o estado normal para
/// quem clonou o repositório e ainda não correu `setup.ps1`.
fn encontrar_pasta_do_servico(base: &Path) -> Option<PathBuf> {
    let candidatos = [
        base.join("voice-clone-service"),
        base.join("../voice-clone-service"),
        base.join("../../voice-clone-service"),
    ];

    candidatos
        .into_iter()
        .find(|caminho| caminho.join(".venv").join("Scripts").join("python.exe").is_file())
        // Canonicalizado já aqui: `FFMPEG_DLL_DIR` vai para `os.add_dll_directory`
        // do lado do Python, que recusa um caminho relativo (`WinError 87`,
        // "o parâmetro está incorreto") — confirmado a sério, não por ler a
        // documentação. `current_dir` também prefere absoluto, por segurança.
        .and_then(|caminho| caminho.canonicalize().ok())
}

fn arrancar(pasta: &Path) -> std::io::Result<Child> {
    let python = pasta.join(".venv").join("Scripts").join("python.exe");
    // Mesma DLL do FFmpeg que `voice-clone-service/README.md` manda apontar
    // à mão — aqui não há janela nenhuma onde a definir, por isso define-se
    // sempre que a pasta existir. Sem ela, a síntese falha a carregar o
    // `torchcodec`; o reconhecimento (Whisper) não precisa dela.
    let ffmpeg_bin = pasta.join("ffmpeg-7.1-full_build-shared").join("bin");

    let mut comando = Command::new(python);
    comando
        .args(["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", &PORT.to_string()])
        .current_dir(pasta)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if ffmpeg_bin.is_dir() {
        comando.env("FFMPEG_DLL_DIR", ffmpeg_bin);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt as _;
        // Sem isto, arrancar a app abria também uma janela de consola preta
        // atrás dela — o `uvicorn` não sabe que devia ficar escondido.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        comando.creation_flags(CREATE_NO_WINDOW);
    }

    comando.spawn()
}

/// Arranca o serviço local de voz (`voice-clone-service/`) sozinho, se
/// houver como — sub-fase 4.4 de `docs/spec/voz-clonada-local.md`. Nunca
/// impede o arranque da app: sem `.venv` instalado, ou já a correr por
/// fora (e saudável), fica tudo exatamente como estava, sem aviso nenhum
/// que interrompa. Se houver algo na porta que não responda como o nosso
/// serviço, mata-se para o arranque não ficar preso a um processo morto.
pub fn setup(app: &AppHandle) {
    if servico_saudavel() {
        eprintln!("[jarvis] voice-clone-service já está a correr — não arranco outro.");
        return;
    }

    matar_servico_preso();

    let base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let Some(pasta) = encontrar_pasta_do_servico(&base) else {
        eprintln!(
            "[jarvis] voice-clone-service não está configurado nesta máquina (sem .venv) \
             — a voz local fica desligada até correres voice-clone-service/setup.ps1."
        );
        return;
    };

    match arrancar(&pasta) {
        Ok(child) => {
            eprintln!("[jarvis] voice-clone-service arrancado sozinho (PID {}).", child.id());
            if let Some(estado) = app.try_state::<VoiceCloneProcess>() {
                *estado.0.lock().expect("lock do processo de voz") = Some(child);
            }
        }
        Err(err) => {
            eprintln!("[jarvis] não consegui arrancar o voice-clone-service sozinho: {err}");
        }
    }
}

/// Mata o processo filho ao sair — nunca deixar um `uvicorn` órfão a ocupar
/// a porta depois da app fechar. Sem efeito se nunca se chegou a arrancar
/// nada (`setup` desistiu, ou já estava a correr por fora).
pub fn cleanup(app: &AppHandle) {
    let Some(estado) = app.try_state::<VoiceCloneProcess>() else { return };
    let filho = estado.0.lock().expect("lock do processo de voz").take();
    if let Some(mut child) = filho {
        let _ = child.kill();
    }
}

/// Reinicia o serviço local de voz — mata o que estiver a correr (o filho
/// gerido e qualquer órfão preso na porta) e volta a arrancar, com um
/// contexto CUDA fresco. É a recuperação em runtime da sub-fase 4.4: o
/// `servico_saudavel()` do `setup` só corre no arranque, e um reset da GPU a
/// meio da sessão envenena o contexto outra vez sem reiniciar a app — a
/// síntese passa a devolver 500 enquanto `/health` continua a responder. Só
/// um processo novo resolve.
#[tauri::command]
pub fn reiniciar_voz_clonada(app: AppHandle) -> Result<(), String> {
    // 1. Mata o filho gerido, se ainda houver um.
    if let Some(estado) = app.try_state::<VoiceCloneProcess>() {
        let filho = estado.0.lock().expect("lock do processo de voz").take();
        if let Some(mut child) = filho {
            let _ = child.kill();
        }
    }

    // 2. Mata qualquer órfão preso — pela linha de comando, como no `setup`,
    // não pela porta (matar por porta podia levar um processo alheio à frente).
    matar_servico_preso();

    // 3. Arranca de novo.
    let base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let Some(pasta) = encontrar_pasta_do_servico(&base) else {
        return Err("voice-clone-service não está configurado nesta máquina (sem .venv)".into());
    };

    match arrancar(&pasta) {
        Ok(child) => {
            eprintln!("[jarvis] voice-clone-service reiniciado (PID {}).", child.id());
            if let Some(estado) = app.try_state::<VoiceCloneProcess>() {
                *estado.0.lock().expect("lock do processo de voz") = Some(child);
            }
            Ok(())
        }
        Err(err) => Err(format!("não consegui arrancar o voice-clone-service de novo: {err}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct TempDir(PathBuf);

    impl TempDir {
        fn novo(nome: &str) -> Self {
            let caminho =
                std::env::temp_dir().join(format!("jarvis-voz-{}-{}", nome, std::process::id()));
            let _ = fs::remove_dir_all(&caminho);
            fs::create_dir_all(&caminho).unwrap();
            TempDir(caminho)
        }

        fn caminho(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn criar_venv(pasta: &Path) {
        fs::create_dir_all(pasta.join(".venv").join("Scripts")).unwrap();
        fs::write(pasta.join(".venv").join("Scripts").join("python.exe"), "").unwrap();
    }

    #[test]
    fn encontra_a_pasta_um_nivel_acima() {
        // O diretório de trabalho real do `tauri dev` é `src-tauri`, com o
        // `voice-clone-service` um nível acima (a raiz do projeto).
        let raiz = TempDir::novo("raiz");
        criar_venv(&raiz.caminho().join("voice-clone-service"));
        let src_tauri = raiz.caminho().join("src-tauri");
        fs::create_dir_all(&src_tauri).unwrap();

        let encontrado = encontrar_pasta_do_servico(&src_tauri).unwrap();
        assert!(encontrado
            .join(".venv")
            .join("Scripts")
            .join("python.exe")
            .is_file());
    }

    #[test]
    fn desiste_sem_venv() {
        let raiz = TempDir::novo("sem-venv");
        fs::create_dir_all(raiz.caminho().join("voice-clone-service")).unwrap();
        assert!(encontrar_pasta_do_servico(raiz.caminho()).is_none());
    }

    #[test]
    fn saude_ok_reconhece_a_resposta() {
        assert!(saude_ok(r#"{"ok": true, "modelo_carregado": true}"#));
        assert!(!saude_ok(r#"{"ok": false}"#));
        assert!(!saude_ok("não é json"));
        assert!(!saude_ok(""));
    }

    #[test]
    fn e_wav_reconhece_audio_a_serio() {
        // Cabeçalho WAV mínimo: "RIFF" + tamanho (4 bytes) + "WAVE".
        let wav = b"RIFF\x24\x00\x00\x00WAVE";
        assert!(e_wav(wav));
        assert!(!e_wav(br#"{"detail":"o modelo falhou"}"#));
        assert!(!e_wav(b""));
        assert!(!e_wav(b"RIFF"));
    }

    #[test]
    fn reconhece_a_linha_de_comando_do_servico() {
        assert!(e_o_nosso_servico(
            r#"C:\Dev\Projetos\Jarvis-novo\voice-clone-service\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8090"#
        ));
        assert!(!e_o_nosso_servico("python outro_script.py"));
        assert!(!e_o_nosso_servico(""));
    }
}
