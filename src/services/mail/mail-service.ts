import { PollingDataService } from '../data-service';
import { MockMailProvider, type MailProvider } from './providers/mail-provider';
import type { MailboxSnapshot, OutgoingMessage } from '@/types/mail';

/** Verificação de correio, de dois em dois minutos. */
const MAIL_INTERVAL_MS = 2 * 60_000;

export class MailService extends PollingDataService<MailboxSnapshot> {
  constructor(private provider: MailProvider = new MockMailProvider()) {
    super({ intervalMs: MAIL_INTERVAL_MS });
  }

  get providerName(): string {
    return this.provider.name;
  }

  get isSimulated(): boolean {
    return this.current?.isSimulated ?? true;
  }

  get unreadCount(): number {
    return this.current?.unreadCount ?? 0;
  }

  /** Quantas mensagens pedem ação — o número que o assistente anuncia. */
  get actionCount(): number {
    return this.current?.actionCount ?? 0;
  }

  setProvider(provider: MailProvider): void {
    this.provider = provider;
    void this.refresh();
  }

  async markRead(messageId: string, isRead = true): Promise<void> {
    await this.provider.markRead(messageId, isRead);
    await this.refresh();
  }

  async toggleStar(messageId: string): Promise<void> {
    await this.provider.toggleStar(messageId);
    await this.refresh();
  }

  /**
   * Envia uma mensagem. Lança se o provedor não enviar — o componente mostra o
   * erro e deixa a mensagem no rascunho, em vez de fingir que saiu.
   */
  async send(message: OutgoingMessage): Promise<void> {
    await this.provider.send(message);
  }

  protected async fetch(): Promise<MailboxSnapshot | null> {
    if (!this.provider.isConfigured()) return null;
    return this.provider.fetch();
  }
}

export const mailService = new MailService();
