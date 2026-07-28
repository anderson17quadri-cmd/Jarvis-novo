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
    body: `Bom dia.

Gostaríamos de ver o sistema a funcionar antes de decidir. Temos duas cadeiras e cerca de quarenta marcações por semana, quase todas por telefone.

Interessa-nos sobretudo perceber como funcionam os lembretes por SMS e se conseguimos gerir os horários de dois barbeiros em simultâneo.

Fica disponível esta semana para uma demonstração?

Cumprimentos,
João Silva`,
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
    body: `O pagamento de €49,00 foi processado e será transferido em 2 dias úteis.

Referência: pi_3QxK2mF8sT
Método: Visa terminado em 4242

Pode consultar o recibo no painel da Stripe.`,
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
    body: `anderson17quadri-cmd fez push de 3 commits para o branch principal.

- Corrige o cálculo dos intervalos entre marcações
- Acrescenta validação ao formulário de cliente
- Atualiza as dependências de segurança

Ver as alterações no repositório.`,
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
    body: `Seguem os preços revistos para a configuração que pediu.

Portátil de desenvolvimento — 32 GB, 1 TB NVMe: €1.480
Monitor 27" 1440p: €310
Estação de ancoragem: €165

Os valores mantêm-se válidos durante 15 dias. Precisamos de confirmação até sexta-feira para garantir o stock.`,
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
    body: `Podemos remarcar para quinta-feira à tarde?

A reunião de terça bateu com a apresentação ao cliente e preferíamos não a fazer à pressa. Quinta às 15h00 dá-nos tempo para rever o protótipo antes.

Diga se lhe serve.`,
    folder: 'inbox',
    priority: 'acao',
    hasAttachments: false,
  },
  {
    id: 'm6',
    from: 'Eu',
    fromAddress: 'anderson@jarvis.local',
    subject: 'Re: Orçamento de hardware atualizado',
    preview: 'Obrigado. Confirmo até sexta, depois de falar com a contabilidade.',
    body: `Obrigado pelos valores revistos.

Confirmo até sexta-feira, depois de falar com a contabilidade. Se houver risco de rutura de stock no monitor, avise-me antes.`,
    folder: 'sent',
    priority: 'info',
    hasAttachments: false,
  },
  {
    id: 'm7',
    from: 'Domínios PT',
    fromAddress: 'faturacao@dominios.pt',
    subject: 'Renovação automática concluída',
    preview: 'O domínio agendado.pt foi renovado por mais 12 meses.',
    body: `O domínio agendado.pt foi renovado por mais 12 meses.

Próxima renovação automática daqui a um ano. Pode desativá-la no painel a qualquer momento.`,
    folder: 'archive',
    priority: 'info',
    hasAttachments: true,
  },
];

export class MockMailProvider implements MailProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  /** Começa com as informativas por ler, para o contador ter sentido. */
  private readonly read = new Set<string>(['m3', 'm6', 'm7']);
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
      // Só a caixa de entrada conta: enviados e arquivo não se "leem".
      unreadCount: messages.filter(
        (message) => message.folder === 'inbox' && !message.isRead,
      ).length,
      // Só as por ler contam para "pedem ação" — uma já lida foi tratada.
      actionCount: messages.filter(
        (message) =>
          message.folder === 'inbox' && message.priority === 'acao' && !message.isRead,
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
