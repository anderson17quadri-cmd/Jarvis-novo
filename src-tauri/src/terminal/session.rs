use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

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
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
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
            let mut utf8 = DecodificadorUtf8::new();
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(n) => {
                        if let Some(chunk) = utf8.push(&buffer[..n]) {
                            let _ = app.emit(
                                EVENT_OUTPUT,
                                TerminalOutputEvent {
                                    session_id: session_id.clone(),
                                    chunk,
                                },
                            );
                        }
                    }
                    Err(_) => break,
                }
            }

            if let Some(chunk) = utf8.flush() {
                let _ = app.emit(
                    EVENT_OUTPUT,
                    TerminalOutputEvent {
                        session_id: session_id.clone(),
                        chunk,
                    },
                );
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
            writer: Arc::new(Mutex::new(writer)),
            child,
        })
    }

    /// Uma pega partilhável para o escritor do stdin. O registo clona-a e
    /// escreve já sem o lock dele segurado: uma escrita ao PTY pode bloquear
    /// quando o buffer de entrada enche (um processo que não lê stdin e uma
    /// colagem grande), e com o lock do registo segurado nenhuma outra sessão
    /// corria — incluindo o `kill` que desbloquearia a situação.
    pub fn writer(&self) -> Arc<Mutex<Box<dyn Write + Send>>> {
        Arc::clone(&self.writer)
    }

    pub fn write(writer: &Arc<Mutex<Box<dyn Write + Send>>>, data: &str) -> Result<()> {
        let mut writer = writer
            .lock()
            .map_err(|_| Error::Terminal("o escritor do terminal ficou num estado inconsistente".to_owned()))?;
        writer
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
        // O portable-pty não colhe o processo ao largar o `Child` — sem um
        // `wait`, um filho morto fica zombie no Unix até a app fechar. O
        // `try_wait` primeiro cobre o shell que já saiu sozinho (`exit`):
        // colhe-o sem sinal nenhum, onde um `kill` falharia por o processo
        // já não existir.
        if let Ok(Some(_)) = self.child.try_wait() {
            return Ok(());
        }
        self.child
            .kill()
            .map_err(|err| Error::Terminal(format!("não terminou o processo: {err}")))?;
        let _ = self.child.wait();
        Ok(())
    }
}

/// Acumula bytes lidos do PTY e devolve texto só até ao último carácter
/// completo. Um `read` corta onde cortar — sem isto, um carácter multi-byte
/// (um `á`, um `ç`, um `€`) apanhado a meio entre dois reads era trocado por
/// `U+FFFD` pelo `from_utf8_lossy`, e o terminal mostrava `�`.
struct DecodificadorUtf8 {
    pendente: Vec<u8>,
}

impl DecodificadorUtf8 {
    fn new() -> Self {
        Self { pendente: Vec::new() }
    }

    /// Junta bytes ao que ficou pendente e devolve o texto completo que já se
    /// pode mostrar — ou `None` se tudo o que há é um carácter a meio.
    fn push(&mut self, bytes: &[u8]) -> Option<String> {
        self.pendente.extend_from_slice(bytes);
        let limite = self.pendente.len() - tail_utf8_incompleto(&self.pendente);
        if limite == 0 {
            return None;
        }
        let texto = String::from_utf8_lossy(&self.pendente[..limite]).into_owned();
        self.pendente.drain(..limite);
        Some(texto)
    }

    /// No fim do stream: emite o que sobrou, mesmo que inválido — nunca fica
    /// nada por mostrar.
    fn flush(&mut self) -> Option<String> {
        if self.pendente.is_empty() {
            return None;
        }
        let texto = String::from_utf8_lossy(&self.pendente).into_owned();
        self.pendente.clear();
        Some(texto)
    }
}

/// Quantos bytes no fim de `bytes` (0 a 3) são o início de uma sequência
/// UTF-8 ainda incompleta, a esperar pelo read seguinte.
fn tail_utf8_incompleto(bytes: &[u8]) -> usize {
    let inicio = bytes.len().saturating_sub(3);
    for i in (inicio..bytes.len()).rev() {
        let b = bytes[i];
        if b & 0b1000_0000 == 0 {
            return 0;
        }
        if b & 0b1100_0000 == 0b1000_0000 {
            continue;
        }
        let precisa = if b & 0b1110_0000 == 0b1100_0000 {
            2
        } else if b & 0b1111_0000 == 0b1110_0000 {
            3
        } else if b & 0b1111_1000 == 0b1111_0000 {
            4
        } else {
            return 0;
        };
        let tem = bytes.len() - i;
        return if tem < precisa { tem } else { 0 };
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn texto_so_ascii_sai_completo_de_uma_vez() {
        let mut d = DecodificadorUtf8::new();
        assert_eq!(d.push(b"echo ola").as_deref(), Some("echo ola"));
    }

    #[test]
    fn caractere_multibyte_cortado_a_meio_entre_dois_reads_nao_parte() {
        // "á" em UTF-8 é 0xC3 0xA1 — simula o primeiro read a cortar mesmo
        // entre os dois bytes, como um `read()` real do PTY pode fazer.
        let texto = "olá mundo";
        let bytes = texto.as_bytes();
        let corte = bytes.iter().position(|&b| b == 0xC3).unwrap() + 1;

        let mut d = DecodificadorUtf8::new();
        let primeiro = d.push(&bytes[..corte]);
        assert_eq!(primeiro.as_deref(), Some("ol"));

        let segundo = d.push(&bytes[corte..]);
        assert_eq!(segundo.as_deref(), Some("á mundo"));
    }

    #[test]
    fn caractere_de_quatro_bytes_cortado_tambem_reconstroi() {
        // "😀" (U+1F600) é 4 bytes em UTF-8.
        let texto = "hi 😀!";
        let bytes = texto.as_bytes();
        let inicio_emoji = bytes.len() - 5; // "!" + os 4 bytes do emoji
        let corte = inicio_emoji + 2; // corta a meio dos 4 bytes do emoji

        let mut d = DecodificadorUtf8::new();
        let primeiro = d.push(&bytes[..corte]);
        assert_eq!(primeiro.as_deref(), Some("hi "));

        let segundo = d.push(&bytes[corte..]);
        assert_eq!(segundo.as_deref(), Some("😀!"));
    }

    #[test]
    fn sequencia_pendente_no_fim_do_stream_sai_no_flush() {
        let bytes = "olá".as_bytes();
        let corte = bytes.len() - 1; // corta o último byte de "á"

        let mut d = DecodificadorUtf8::new();
        d.push(&bytes[..corte]);
        assert!(d.flush().is_some());
        assert!(d.flush().is_none(), "depois do flush não deve sobrar nada");
    }

    #[test]
    fn sem_nada_pendente_flush_nao_devolve_nada() {
        let mut d = DecodificadorUtf8::new();
        assert!(d.flush().is_none());
    }
}
