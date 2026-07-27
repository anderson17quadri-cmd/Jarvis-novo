import type { MailboxSnapshot, MailMessage } from '@/types/mail';

/**
 * Contrato de um provedor de email.
 *
 * `markRead` e `toggleStar` estão no contrato porque um provedor real
 * (IMAP, Gmail API) sincroniza essas marcas com o servidor.
 */
export interface MailProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  fetch(signal?: AbortSignal): Promise<MailboxSnapshot | null>;
  markRead(messageId: string, isRead: boolean): Promise<void>;
  toggleStar(messageId: string): Promise<void>;
}

type Seed = Omit<MailMessage, 'receivedAt' | 'isRead' | 'isStarred'>;

const SEED: readonly Seed[] = [
  {
    id: 'm1',
    from: 'Barbearia Silva',
    fromAddress: 'geral@barbeariasilva.pt',
    subject: 'Pedido de demonstração do Agendado',
    preview: 'Bom dia. Gostaríamos de ver o sistema a funcionar antes de decidir.',
    folder: 'inbox',
    priority: 'acao',
    hasAttachments: false,
  },
  {
    id: 'm2',
    from: 'Stripe',
    fromAddress: 'no-reply@stripe.com',
    subject: 'Pagamento processado com sucesso',
    preview: 'O pagamento de €49,00 foi processado e será transferido em 2 dias úteis.',
    folder: 'inbox',
    priority: 'info',
    hasAttachments: true,
  },
  {
    id: 'm3',
    from: 'GitHub',
    fromAddress: 'notifications@github.com',
    subject: '3 novos commits em barbearia-v2',
    preview: 'anderson17quadri-cmd fez push de 3 commits para o branch principal.',
    folder: 'inbox',
    priority: 'info',
    hasAttachments: false,
  },
  {
    id: 'm4',
    from: 'Fornecedor Hardware',
    fromAddress: 'vendas@fornecedor.pt',
    subject: 'Orçamento de hardware atualizado',
    preview: 'Seguem os preços revistos para a configuração que pediu.',
    folder: 'inbox',
    priority: 'acao',
    hasAttachments: true,
  },
  {
    id: 'm5',
    from: 'Cliente — Voxel Studio',
    fromAddress: 'contacto@voxelstudio.pt',
    subject: 'Reunião de acompanhamento',
    preview: 'Podemos remarcar para quinta-feira à tarde?',
    folder: 'inbox',
    priority: 'acao',
    hasAttachments: false,
  },
];

export class MockMailProvider implements MailProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  /** Começa com as informativas por ler, para o contador ter sentido. */
  private readonly read = new Set<string>(['m3']);
  private readonly starred = new Set<string>(['m1']);

  isConfigured(): boolean {
    return true;
  }

  async fetch(): Promise<MailboxSnapshot> {
    const now = Date.now();

    const messages: MailMessage[] = SEED.map((seed, index) => ({
      ...seed,
      receivedAt: now - (index * 73 + 25) * 60_000,
      isRead: this.read.has(seed.id),
      isStarred: this.starred.has(seed.id),
    }));

    return {
      messages,
      unreadCount: messages.filter((message) => !message.isRead).length,
      // Só as por ler contam para "pedem ação" — uma já lida foi tratada.
      actionCount: messages.filter(
        (message) => message.priority === 'acao' && !message.isRead,
      ).length,
      fetchedAt: now,
      isSimulated: true,
    };
  }

  async markRead(messageId: string, isRead: boolean): Promise<void> {
    if (isRead) this.read.add(messageId);
    else this.read.delete(messageId);
  }

  async toggleStar(messageId: string): Promise<void> {
    if (this.starred.has(messageId)) this.starred.delete(messageId);
    else this.starred.add(messageId);
  }
}
