/** Email (Parte 6.2 §Widgets previstos). */

export type MailFolder = 'inbox' | 'sent' | 'archive';
/** Marcação que a triagem do assistente atribui. */
export type MailPriority = 'acao' | 'info';

export interface MailMessage {
  readonly id: string;
  readonly from: string;
  readonly fromAddress: string;
  readonly subject: string;
  readonly preview: string;
  readonly folder: MailFolder;
  readonly priority: MailPriority;
  /** Milissegundos desde a época Unix. */
  readonly receivedAt: number;
  readonly isRead: boolean;
  readonly isStarred: boolean;
  readonly hasAttachments: boolean;
}

export interface MailboxSnapshot {
  readonly messages: readonly MailMessage[];
  readonly unreadCount: number;
  /** Quantas mensagens pedem ação — é o número que o assistente anuncia. */
  readonly actionCount: number;
  readonly fetchedAt: number;
  readonly isSimulated: boolean;
}

export const MAIL_PRIORITY_LABELS: Record<MailPriority, string> = {
  acao: 'Ação',
  info: 'Info',
};
