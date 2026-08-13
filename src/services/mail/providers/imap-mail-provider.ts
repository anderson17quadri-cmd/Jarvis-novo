import { getPlatformAdapter } from '@/platform';
import type { MailboxSnapshot, MailMessage, OutgoingMessage } from '@/types/mail';
import type { MailSettings } from '@/types/mail-settings';
import type { MailProvider } from './mail-provider';

/**
 * Provedor real de email — IMAP para ler, SMTP para enviar.
 *
 * Ao contrário da meteorologia e das notícias (que usam `fetch`), o correio
 * fala com o Rust pelos comandos `mail_fetch`/`mail_set_flag`/`mail_send`, que
 * o adapter expõe como `mailFetch`/`mailSetFlag`/`mailSend`. As credenciais
 * nunca tocam no storage: vivem no cofre do sistema e viajam só na memória,
 * de cada vez que um comando as pede.
 *
 * **Limites desta primeira versão (documentados, não fingidos):**
 * - lê-se só a INBOX — "enviados" e "arquivo" continuam do simulado;
 * - o corpo vem como o servidor o dá, truncado a 32 kB, sem descodificar
 *   base64/quoted-printable nem extrair anexos;
 * - a prioridade fica sempre em `info`: a triagem "ação" é do assistente
 *   simulado e ainda não está ligada a correio real;
 * - o envio usa STARTTLS na porta 587, um só destinatário por mensagem, e o
 *   remetente é a própria conta (`from` = utilizador); anexos do rascunho não
 *   seguem na mensagem.
 */

/** Quantas mensagens se pedem por leitura — as mais recentes da INBOX. */
const MAIL_FETCH_LIMIT = 50;

export class ImapMailProvider implements MailProvider {
  readonly id = 'imap';
  readonly name = 'IMAP';

  /**
   * Estado de favorito da última leitura, para o `toggleStar` saber o valor a
   * aplicar. Não é autoridade nenhuma — a verdade vem do servidor na leitura
   * seguinte — mas evita pedir o estado atual a cada clique.
   */
  private readonly starred = new Map<string, boolean>();

  constructor(private readonly settings: MailSettings) {}

  isConfigured(): boolean {
    return (
      this.settings.imapServer.trim().length > 0 &&
      this.settings.username.trim().length > 0 &&
      this.settings.password.trim().length > 0
    );
  }

  async fetch(): Promise<MailboxSnapshot> {
    const adapter = getPlatformAdapter();
    const dtos = await adapter.mailFetch({
      imapServer: this.settings.imapServer.trim(),
      imapPort: this.settings.imapPort,
      username: this.settings.username.trim(),
      password: this.settings.password,
      limit: MAIL_FETCH_LIMIT,
    });

    const messages: MailMessage[] = dtos.map((dto) => ({
      id: dto.id,
      from: dto.from,
      fromAddress: dto.fromAddress,
      subject: dto.subject,
      preview: dto.preview,
      body: dto.body,
      folder: 'inbox',
      priority: 'info',
      receivedAt: dto.receivedAt,
      isRead: dto.isRead,
      isStarred: dto.isStarred,
      hasAttachments: dto.hasAttachments,
      attachments: [],
    }));

    for (const message of messages) this.starred.set(message.id, message.isStarred);

    return {
      messages,
      unreadCount: messages.filter((message) => !message.isRead).length,
      // Sem triagem ligada a correio real, nenhuma mensagem "pede ação".
      actionCount: 0,
      fetchedAt: Date.now(),
      isSimulated: false,
    };
  }

  async markRead(messageId: string, isRead: boolean): Promise<void> {
    await this.setFlag(messageId, 'seen', isRead);
  }

  async toggleStar(messageId: string): Promise<void> {
    const next = !(this.starred.get(messageId) ?? false);
    await this.setFlag(messageId, 'flagged', next);
    this.starred.set(messageId, next);
  }

  async send(message: OutgoingMessage): Promise<void> {
    const smtpServer = this.settings.smtpServer.trim();
    if (smtpServer.length === 0) {
      throw new Error('falta o servidor SMTP — defina-o em Personalização → Correio');
    }

    await getPlatformAdapter().mailSend({
      smtpServer,
      smtpPort: this.settings.smtpPort,
      username: this.settings.username.trim(),
      password: this.settings.password,
      from: this.settings.username.trim(),
      to: message.to.trim(),
      subject: message.subject,
      body: message.body,
    });
  }

  private async setFlag(messageId: string, flag: 'seen' | 'flagged', value: boolean): Promise<void> {
    await getPlatformAdapter().mailSetFlag({
      imapServer: this.settings.imapServer.trim(),
      imapPort: this.settings.imapPort,
      username: this.settings.username.trim(),
      password: this.settings.password,
      messageId,
      flag,
      value,
    });
  }
}
