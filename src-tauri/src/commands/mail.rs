use std::net::TcpStream;

use serde::Serialize;

use crate::error::{Error, Result};

/// Mensagem lida de uma caixa IMAP real, no contrato `MailMessage` da
/// interface (camelCase).
///
/// Só se lê a INBOX nesta primeira versão — as pastas "enviados" e "arquivo"
/// do widget continuam a vir do provedor simulado. A prioridade fica sempre em
/// `"info"`: a triagem que marca "ação" é do assistente simulado e ainda não
/// está ligada a correio real.
///
/// **Corpo e anexos.** O corpo é devolvido como o servidor o dá
/// (`BODY.PEEK[TEXT]`), truncado a 32 kB; codificações de transferência
/// (base64/quoted-printable) não são descodificadas nesta versão, e anexos não
/// são extraídos — fica tudo documentado aqui em vez de fingido.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImapMessage {
    id: String,
    from: String,
    from_address: String,
    subject: String,
    preview: String,
    body: String,
    received_at: i64,
    is_read: bool,
    is_starred: bool,
    has_attachments: bool,
}

/// Tamanho máximo do corpo devolvido à interface, para não mandar uma
/// mensagem inteira de 20 MB por IPC a cada leitura.
const MAX_BODY_BYTES: usize = 32_000;

/// Converte a data RFC 2822 do cabeçalho `Date` (bytes crus do ENVELOPE) em
/// milissegundos desde a época. Se não existir ou não se conseguir ler, `0` —
/// a mensagem aparece na mesma, só fica no fim da lista.
fn parse_date(raw: Option<&[u8]>) -> i64 {
    let Some(bytes) = raw else { return 0 };
    let Ok(text) = std::str::from_utf8(bytes) else { return 0 };
    chrono::DateTime::parse_from_rfc2822(text)
        .map(|date| date.timestamp_millis())
        .unwrap_or(0)
}

/// Liga e autentica contra o servidor IMAP. Devolve a sessão já com a INBOX
/// selecionada — os comandos seguintes só precisam de pedir/alterar.
fn open_inbox(
    server: &str,
    port: u16,
    username: &str,
    password: &str,
) -> Result<imap::Session<native_tls::TlsStream<TcpStream>>> {
    let tls = native_tls::TlsConnector::builder()
        .build()
        .map_err(|e| Error::SystemRead(format!("não deu para preparar o TLS: {e}")))?;

    let client = imap::connect((server, port), server, &tls)
        .map_err(|e| Error::SystemRead(format!("não deu para ligar ao servidor IMAP {server}:{port}: {e}")))?;

    let mut session = client
        .login(username, password)
        .map_err(|(e, _)| Error::SystemRead(format!("o servidor IMAP recusou o início de sessão: {e}")))?;

    session
        .select("INBOX")
        .map_err(|e| Error::SystemRead(format!("não deu para abrir a caixa de entrada: {e}")))?;

    Ok(session)
}

/// Lê as mensagens mais recentes da INBOX por IMAP.
///
/// Só pede a INBOX e usa `BODY.PEEK` — que lê o corpo **sem** marcar a
/// mensagem como lida. Ler o correio não pode ter o efeito secundário de o
/// marcar como lido; isso fica para `mail_set_flag`.
#[tauri::command(async)]
pub fn mail_fetch(
    imap_server: String,
    imap_port: u16,
    username: String,
    password: String,
    limit: usize,
) -> Result<Vec<ImapMessage>> {
    let mut session = open_inbox(&imap_server, imap_port, &username, &password)?;

    // Quantas mensagens há — `select` devolve o `Mailbox` com o total.
    let mailbox = session
        .select("INBOX")
        .map_err(|e| Error::SystemRead(format!("não deu para abrir a caixa de entrada: {e}")))?;
    let total = mailbox.exists as usize;
    if total == 0 {
        return Ok(Vec::new());
    }

    // As últimas `limit` mensagens, da mais antiga para a mais recente.
    let start = total.saturating_sub(limit).saturating_add(1);
    let range = format!("{start}:*");

    let fetches = session
        .fetch(&range, "(UID FLAGS INTERNALDATE ENVELOPE BODY.PEEK[TEXT])")
        .map_err(|e| Error::SystemRead(format!("não deu para ler as mensagens: {e}")))?;

    let mut messages = Vec::new();
    for (index, fetch) in fetches.iter().enumerate() {
        // O UID é o identificador estável que a interface usa em `mail_set_flag`.
        let id = fetch
            .uid
            .map(|uid| uid.to_string())
            .unwrap_or_else(|| format!("seq-{index}"));

        let is_read = fetch.flags().contains(&imap::types::Flag::Seen);
        let is_starred = fetch.flags().contains(&imap::types::Flag::Flagged);

        let (from, from_address) = fetch
            .envelope()
            .and_then(|envelope| envelope.from.as_ref())
            .and_then(|list| list.first())
            .map(|address| {
                let name = address
                    .name
                    .as_ref()
                    .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                    .unwrap_or_default();
                let mailbox = address
                    .mailbox
                    .as_ref()
                    .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                    .unwrap_or_default();
                let host = address
                    .host
                    .as_ref()
                    .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                    .unwrap_or_default();

                let address_text = if host.is_empty() {
                    mailbox.clone()
                } else {
                    format!("{mailbox}@{host}")
                };
                let display = if name.is_empty() {
                    address_text.clone()
                } else {
                    name
                };
                (display, address_text)
            })
            .unwrap_or_else(|| {
                (
                    "(remetente desconhecido)".to_string(),
                    String::new(),
                )
            });

        let subject = fetch
            .envelope()
            .and_then(|envelope| envelope.subject.as_ref())
            .map(|bytes| String::from_utf8_lossy(bytes).to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "(sem assunto)".to_string());

        // A data do cabeçalho `Date` é a que o remetente escreveu — pode
        // mentir, mas é o que o servidor dá no ENVELOPE sem pedidos extra.
        let received_at = parse_date(fetch.envelope().and_then(|envelope| envelope.date));

        let body = fetch
            .text()
            .map(|bytes| {
                let slice = if bytes.len() > MAX_BODY_BYTES {
                    &bytes[..MAX_BODY_BYTES]
                } else {
                    bytes
                };
                String::from_utf8_lossy(slice).to_string()
            })
            .unwrap_or_default();
        let preview = body.chars().take(160).collect();

        messages.push(ImapMessage {
            id,
            from,
            from_address,
            subject,
            preview,
            body,
            received_at,
            is_read,
            is_starred,
            has_attachments: false,
        });
    }

    Ok(messages)
}

/// Muda uma bandeira de uma mensagem no servidor — `seen` (lida) ou `flagged`
/// (favorita). É isto que sincroniza as marcas de leitura e de favorito, em
/// vez de as guardar só na memória do dispositivo.
#[tauri::command(async)]
pub fn mail_set_flag(
    imap_server: String,
    imap_port: u16,
    username: String,
    password: String,
    message_id: String,
    flag: String,
    value: bool,
) -> Result<()> {
    let mut session = open_inbox(&imap_server, imap_port, &username, &password)?;

    let flag_name = match flag.as_str() {
        "seen" => "Seen",
        "flagged" => "Flagged",
        other => return Err(Error::SystemRead(format!("bandeira IMAP desconhecida: {other}"))),
    };
    let operation = if value { "+FLAGS" } else { "-FLAGS" };

    // O `uid_store` do imap 2.x leva as bandeiras dentro da própria query
    // (`+FLAGS (\Seen)`), não como um terceiro argumento.
    let query = format!("{operation} (\\{flag_name})");
    session
        .uid_store(&message_id, query)
        .map_err(|e| Error::SystemRead(format!("não deu para atualizar a mensagem: {e}")))?;

    Ok(())
}

/// Envia uma mensagem por SMTP.
///
/// Usa STARTTLS (a porta 587 de origem), que é o caminho comum dos servidores
/// modernos — a porta 465 (TLS implícito) fica de fora desta versão. Um só
/// destinatário por envio; o remetente é a própria conta (`from` = utilizador).
// Oito argumentos achatados são o contrato do IPC: a interface passa cada
// campo em camelCase e o Tauri converte um a um. Agrupar num struct obrigaria
// a interface a embrulhar tudo num objeto aninhado, por isso o lint fica
// desligado aqui — é o preço do formato estável de `invoke`.
#[allow(clippy::too_many_arguments)]
#[tauri::command(async)]
pub fn mail_send(
    smtp_server: String,
    smtp_port: u16,
    username: String,
    password: String,
    from: String,
    to: String,
    subject: String,
    body: String,
) -> Result<()> {
    enviar_por_smtp(
        &smtp_server,
        smtp_port,
        &username,
        &password,
        &from,
        &to,
        &subject,
        &body,
    )
}

/// Monta a mensagem e envia-a por SMTP.
///
/// Separada do comando para o teste poder observar o que chega primeiro ao fio
/// sem um executor async — o corpo é bloqueante. `starttls_relay` (STARTTLS) e
/// não `relay`: este último faz TLS implícito (SMTPS, porta 465) e, na porta
/// 587 de origem, falharia logo no `ClientHello` que os servidores STARTTLS não
/// esperam.
fn enviar_por_smtp(
    smtp_server: &str,
    smtp_port: u16,
    username: &str,
    password: &str,
    from: &str,
    to: &str,
    subject: &str,
    body: &str,
) -> Result<()> {
    use lettre::Transport;

    let email = lettre::Message::builder()
        .from(
            from.parse()
                .map_err(|e| Error::SystemRead(format!("remetente inválido '{from}': {e}")))?,
        )
        .to(to.parse()
            .map_err(|e| Error::SystemRead(format!("destinatário inválido '{to}': {e}")))?)
        .subject(subject)
        .body(body.to_owned())
        .map_err(|e| Error::SystemRead(format!("não deu para montar a mensagem: {e}")))?;

    let creds = lettre::transport::smtp::authentication::Credentials::new(
        username.to_string(),
        password.to_string(),
    );

    let mailer = lettre::SmtpTransport::starttls_relay(smtp_server)
        .map_err(|e| {
            Error::SystemRead(format!("não deu para preparar o envio para {smtp_server}: {e}"))
        })?
        .port(smtp_port)
        .credentials(creds)
        .build();

    mailer
        .send(&email)
        .map_err(|e| Error::SystemRead(format!("o servidor SMTP recusou o envio: {e}")))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    /// Prova que o envio começa por um EHLO em claro (STARTTLS), não por um
    /// handshake TLS (TLS implícito). Na porta 587 os servidores esperam
    /// STARTTLS: com TLS implícito o primeiro byte no fio seria o `0x16` de um
    /// `ClientHello`, e o servidor desligaria antes de se entender com o cliente.
    #[test]
    fn envio_comeca_por_ehlo_em_claro() {
        let servidor = TcpListener::bind("127.0.0.1:0").unwrap();
        let porta = servidor.local_addr().unwrap().port();

        let leitor = std::thread::spawn(move || {
            let (mut ligacao, _) = servidor.accept().unwrap();
            ligacao.write_all(b"220 teste ESMTP\r\n").unwrap();
            let mut primeiro = [0u8; 1];
            ligacao.read_exact(&mut primeiro).unwrap();
            primeiro[0]
        });

        // O envio falha (o servidor de teste não responde ao EHLO) — o que
        // interessa é o que chegou primeiro ao fio, não o resultado.
        let _ = enviar_por_smtp(
            "127.0.0.1",
            porta,
            "utilizador",
            "palavra-passe",
            "a@exemplo.pt",
            "b@exemplo.pt",
            "assunto",
            "corpo",
        );

        let primeiro_byte = leitor.join().unwrap();
        assert_eq!(
            primeiro_byte, b'E',
            "o primeiro byte devia ser 'E' (EHLO, STARTTLS), mas foi {primeiro_byte:#x} (TLS implícito)"
        );
    }
}
