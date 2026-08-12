use std::io::{Read, Write};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{Error, Result};

/// O programa que toda a sessão corre — nunca escolhido pela interface. Ver
/// o comentário em `mod.rs` para a razão de ser fixo.
#[cfg(target_os = "windows")]
const SHELL_PROGRAM: &str = "powershell.exe";
#[cfg(not(target_os = "windows"))]
const SHELL_PROGRAM: &str = "/bin/sh";

/// Evento emitido a cada bocado de saída lido do PTY.
#[derive(Clone, Serialize)]
pub struct TerminalOutputEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub chunk: String,
}

/// Evento emitido quando o processo da sessão termina, por si ou por `kill`.
#[derive(Clone, Serialize)]
pub struct TerminalExitEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
}

pub const EVENT_OUTPUT: &str = "terminal://output";
pub const EVENT_EXIT: &str = "terminal://exit";

/// Uma sessão de terminal viva: o processo, o escritor do stdin, e o `master`
/// do PTY (precisa de ficar vivo — largá-lo fecha o par PTY inteiro).
pub struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

impl TerminalSession {
    /// Abre um PTY novo, arranca o shell, e põe uma thread a ler a saída e a
    /// emiti-la para a interface. `session_id` já identifica esta sessão nos
    /// eventos — quem chama gera o id antes de invocar isto.
    pub fn spawn(app: AppHandle, session_id: String, cols: u16, rows: u16) -> Result<Self> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| Error::Terminal(format!("não abriu o PTY: {err}")))?;

        let cmd = CommandBuilder::new(SHELL_PROGRAM);
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|err| Error::Terminal(format!("não arrancou o {SHELL_PROGRAM}: {err}")))?;

        // O `slave` só serve para arrancar o processo — no Windows nem
        // implementa `Read`/`Write`. Depois de o filho nascer, larga-se.
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|err| Error::Terminal(format!("não abriu leitura do PTY: {err}")))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|err| Error::Terminal(format!("não abriu escrita do PTY: {err}")))?;

        // A leitura do PTY é bloqueante — corre numa thread própria, uma por
        // sessão, que emite cada bocado lido e para sozinha no EOF (o shell
        // fechou) ou num erro de leitura.
        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buffer[..n]).into_owned();
                        let _ = app.emit(
                            EVENT_OUTPUT,
                            TerminalOutputEvent {
                                session_id: session_id.clone(),
                                chunk,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }

            let _ = app.emit(
                EVENT_EXIT,
                TerminalExitEvent {
                    session_id: session_id.clone(),
                    // Não há forma de saber o código de saída aqui: o `child`
                    // ficou na `TerminalSession`, fora desta thread, para o
                    // `kill` da interface lhe poder chegar. Sem código de
                    // saída é melhor do que inventar um.
                    exit_code: None,
                },
            );
        });

        Ok(Self {
            master: pair.master,
            writer,
            child,
        })
    }

    pub fn write(&mut self, data: &str) -> Result<()> {
        self.writer
            .write_all(data.as_bytes())
            .map_err(|err| Error::Terminal(format!("não escreveu no terminal: {err}")))
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| Error::Terminal(format!("não redimensionou o terminal: {err}")))
    }

    pub fn kill(&mut self) -> Result<()> {
        self.child
            .kill()
            .map_err(|err| Error::Terminal(format!("não terminou o processo: {err}")))
    }
}
