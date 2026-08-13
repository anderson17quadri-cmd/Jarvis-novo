/** Email (Parte 6.2 §Widgets previstos). */

import type { Attachment } from './attachment';

export type MailFolder = 'inbox' | 'sent' | 'archive';
/** Marcação que a triagem do assistente atribui. */
export type MailPriority = 'acao' | 'info';

export interface MailMessage {
  readonly id: string;
  readonly from: string;
  readonly fromAddress: string;
  readonly subject: string;
  readonly preview: string;
  /** Corpo da mensagem, para a janela de leitura. */
  readonly body: string;
  readonly folder: MailFolder;
  readonly priority: MailPriority;
  /** Milissegundos desde a época Unix. */
  readonly receivedAt: number;
  readonly isRead: boolean;
  readonly isStarred: boolean;
  readonly hasAttachments: boolean;
  /** Anexos reais (11/08/2026). Vazio para mensagens simuladas sem anexos. */
  readonly attachments: readonly Attachment[];
}

export interface MailboxSnapshot {
  readonly messages: readonly MailMessage[];
  readonly unreadCount: number;
  /** Quantas mensagens pedem ação — é o número que o assistente anuncia. */
  readonly actionCount: number;
  readonly fetchedAt: number;
  readonly isSimulated: boolean;
}

/**
 * Mensagem tal como o comando Rust `mail_fetch` a devolve (camelCase).
 *
 * Só a INBOX é lida, por isso não há `folder` — o provedor IMAP mapeia tudo
 * para `'inbox'`. A prioridade também não vem do servidor: a triagem "ação" é
 * do assistente simulado e ainda não está ligada a correio real.
 */
export interface ImapMessageDto {
  readonly id: string;
  readonly from: string;
  readonly fromAddress: string;
  readonly subject: string;
  readonly preview: string;
  readonly body: string;
  readonly receivedAt: number;
  readonly isRead: boolean;
  readonly isStarred: boolean;
  readonly hasAttachments: boolean;
}

/** Mensagem a enviar — o remetente é sempre a conta configurada. */
export interface OutgoingMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

// ── Argumentos dos comandos Rust de correio ────────────────────────────────
// Os nomes são camelCase porque o Tauri converte os argumentos snake_case do
// Rust (imap_server → imapServer) automaticamente no `invoke`.

export interface MailFetchParams {
  readonly imapServer: string;
  readonly imapPort: number;
  readonly username: string;
  readonly password: string;
  readonly limit: number;
}

export interface MailSetFlagParams {
  readonly imapServer: string;
  readonly imapPort: number;
  readonly username: string;
  readonly password: string;
  readonly messageId: string;
  readonly flag: 'seen' | 'flagged';
  readonly value: boolean;
}

export interface MailSendParams {
  readonly smtpServer: string;
  readonly smtpPort: number;
  readonly username: string;
  readonly password: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export const MAIL_PRIORITY_LABELS: Record<MailPriority, string> = {
  acao: 'Ação',
  info: 'Info',
};
