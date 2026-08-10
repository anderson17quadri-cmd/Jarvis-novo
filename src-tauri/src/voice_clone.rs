use std::net::TcpStream;
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

/// Já está algo a ouvir na porta do serviço — nosso ou de outra pessoa (por
/// exemplo, quem já tiver corrido `.\run.ps1` à mão numa janela à parte).
fn ja_a_correr() -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{PORT}").parse().expect("endereço local válido"),
        Duration::from_millis(300),
    )
    .is_ok()
}

/// Onde `voice-clone-service/` deve estar — só faz sentido em
/// desenvolvimento, a correr a partir do código-fonte nesta máquina: o
/// `.venv` (mais de 2 GB, com o PyTorch) não viaja com um build instalado.
/// Tenta um punhado de sítios prováveis a partir do diretório de trabalho
/// atual (que muda consoante se corre via `cargo run`/`tauri dev` ou o
/// executável já compilado), e desiste em silêncio se não encontrar
/// nenhum — arrancar sem o serviço de voz é o estado normal para quem
/// clonou o repositório e ainda não correu `setup.ps1`.
fn encontrar_pasta_do_servico() -> Option<PathBuf> {
    let candidatos = [
        PathBuf::from("voice-clone-service"),
        PathBuf::from("../voice-clone-service"),
        PathBuf::from("../../voice-clone-service"),
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
/// fora, fica tudo exatamente como estava, sem aviso nenhum que interrompa.
pub fn setup(app: &AppHandle) {
    if ja_a_correr() {
        eprintln!("[jarvis] voice-clone-service já está a correr — não arranco outro.");
        return;
    }

    let Some(pasta) = encontrar_pasta_do_servico() else {
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
