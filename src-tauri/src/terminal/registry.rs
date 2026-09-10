use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::AppHandle;

use super::session::TerminalSession;
use crate::error::{Error, Result};

/// Todas as sessões de terminal vivas, uma app pode ter mais do que uma
/// janela de Terminal aberta ao mesmo tempo.
#[derive(Default)]
pub struct TerminalRegistry {
    sessions: Mutex<HashMap<String, TerminalSession>>,
    next_id: AtomicU64,
}

impl TerminalRegistry {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, HashMap<String, TerminalSession>>> {
        self.sessions
            .lock()
            .map_err(|_| Error::Terminal("o registo de sessões ficou num estado inconsistente".to_owned()))
    }

    pub fn spawn(&self, app: AppHandle, cols: u16, rows: u16) -> Result<String> {
        let id = format!("term-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let session = TerminalSession::spawn(app, id.clone(), cols, rows)?;

        self.lock()?.insert(id.clone(), session);
        Ok(id)
    }

    /// O lock do registo fecha-se antes de escrever: uma escrita ao PTY pode
    /// bloquear (buffer de entrada cheio, processo que não lê stdin), e
    /// segurar o `Mutex` do registo durante isso travaria qualquer outra
    /// sessão — incluindo o `kill` de outra janela de Terminal, que é
    /// exatamente o que desbloquearia a situação.
    pub fn write(&self, session_id: &str, data: &str) -> Result<()> {
        let writer = {
            let sessions = self.lock()?;
            let session = sessions
                .get(session_id)
                .ok_or_else(|| Error::UnknownSession(session_id.to_owned()))?;
            session.writer()
        };
        TerminalSession::write(&writer, data)
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        let sessions = self.lock()?;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| Error::UnknownSession(session_id.to_owned()))?;
        session.resize(cols, rows)
    }

    /// Termina e esquece a sessão. Chamar duas vezes com o mesmo id não é
    /// erro — a segunda vez já não a encontra, o que é exatamente o estado
    /// desejado, por isso devolve `Ok(())` em vez de `UnknownSession`.
    pub fn kill(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.lock()?;
        if let Some(mut session) = sessions.remove(session_id) {
            session.kill()?;
        }
        Ok(())
    }
}
