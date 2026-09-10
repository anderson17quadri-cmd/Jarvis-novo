import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImapMessageDto } from '@/types/mail';
import { DEFAULT_MAIL_SETTINGS, type MailSettings } from '@/types/mail-settings';

/**
 * O provedor IMAP fala com o Rust pelos comandos `mail_*`, expostos no
 * adapter como `mailFetch`/`mailSetFlag`/`mailSend`. Estes testes trocam o
 * adapter por um falso que regista as chamadas — sem rede nem IPC.
 */
const mocks = vi.hoisted(() => ({
  mailFetch: vi.fn(),
  mailSetFlag: vi.fn(),
  mailSend: vi.fn(),
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    mailFetch: mocks.mailFetch,
    mailSetFlag: mocks.mailSetFlag,
    mailSend: mocks.mailSend,
  }),
}));

import { ImapMailProvider } from '@/services/mail/providers/imap-mail-provider';

function settings(overrides: Partial<MailSettings> = {}): MailSettings {
  return { ...DEFAULT_MAIL_SETTINGS, ...overrides };
}

const DTO: ImapMessageDto = {
  id: '101',
  from: 'João Silva',
  fromAddress: 'joao@exemplo.pt',
  subject: 'Pedido de orçamento',
  preview: 'Bom dia, seguem os valores.',
  body: 'Bom dia, seguem os valores.',
  receivedAt: 1_750_000_000_000,
  isRead: false,
  isStarred: false,
  hasAttachments: false,
};

beforeEach(() => {
  mocks.mailFetch.mockReset();
  mocks.mailSetFlag.mockReset();
  mocks.mailSend.mockReset();
  mocks.mailSetFlag.mockResolvedValue(undefined);
  mocks.mailSend.mockResolvedValue(undefined);
});

describe('ImapMailProvider — configuração', () => {
  it('sem servidor, utilizador ou palavra-passe, não está configurado', () => {
    expect(new ImapMailProvider(settings()).isConfigured()).toBe(false);
    expect(new ImapMailProvider(settings({ imapServer: 'imap.gmail.com' })).isConfigured()).toBe(
      false,
    );
    expect(new ImapMailProvider(settings({ username: 'voce@exemplo.com' })).isConfigured()).toBe(
      false,
    );
  });

  it('com servidor + utilizador + palavra-passe, está configurado', () => {
    expect(
      new ImapMailProvider(
        settings({ imapServer: 'imap.gmail.com', username: 'voce@exemplo.com', password: 'p' }),
      ).isConfigured(),
    ).toBe(true);
  });
});

describe('ImapMailProvider — ler', () => {
  it('pede as mensagens ao adapter com as credenciais e mapeia para a interface', async () => {
    mocks.mailFetch.mockResolvedValue([DTO]);

    const provider = new ImapMailProvider(
      settings({ imapServer: 'imap.gmail.com', username: 'voce@exemplo.com', password: 'segredo' }),
    );
    const snapshot = await provider.fetch();

    expect(mocks.mailFetch).toHaveBeenCalledWith({
      imapServer: 'imap.gmail.com',
      imapPort: 993,
      username: 'voce@exemplo.com',
      password: 'segredo',
      limit: 50,
    });

    expect(snapshot.isSimulated).toBe(false);
    expect(snapshot.actionCount).toBe(0);
    expect(snapshot.messages).toHaveLength(1);

    const message = snapshot.messages[0]!;
    expect(message.id).toBe('101');
    expect(message.from).toBe('João Silva');
    expect(message.fromAddress).toBe('joao@exemplo.pt');
    expect(message.folder).toBe('inbox');
    expect(message.priority).toBe('info');
    expect(message.receivedAt).toBe(1_750_000_000_000);
    expect(message.attachments).toEqual([]);
  });

  it('conta as por ler a partir do que o servidor devolveu', async () => {
    mocks.mailFetch.mockResolvedValue([
      DTO,
      { ...DTO, id: '102', isRead: true },
      { ...DTO, id: '103', isRead: false },
    ]);

    const snapshot = await new ImapMailProvider(settings()).fetch();

    expect(snapshot.unreadCount).toBe(2);
  });
});

describe('ImapMailProvider — bandeiras', () => {
  it('marcar como lida pede a bandeira seen', async () => {
    const provider = new ImapMailProvider(
      settings({ imapServer: 'imap.gmail.com', username: 'u', password: 'p' }),
    );

    await provider.markRead('101', true);

    expect(mocks.mailSetFlag).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: '101', flag: 'seen', value: true }),
    );
  });

  it('o favorito alterna entre marcar e desmarcar', async () => {
    mocks.mailFetch.mockResolvedValue([DTO]);
    const provider = new ImapMailProvider(
      settings({ imapServer: 'imap.gmail.com', username: 'u', password: 'p' }),
    );
    await provider.fetch();

    await provider.toggleStar('101');
    await provider.toggleStar('101');

    expect(mocks.mailSetFlag).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ messageId: '101', flag: 'flagged', value: true }),
    );
    expect(mocks.mailSetFlag).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ messageId: '101', flag: 'flagged', value: false }),
    );
  });
});

describe('ImapMailProvider — enviar', () => {
  it('envia pela conta configurada, como remetente', async () => {
    const provider = new ImapMailProvider(
      settings({
        imapServer: 'imap.gmail.com',
        smtpServer: 'smtp.gmail.com',
        smtpPort: 587,
        username: 'voce@exemplo.com',
        password: 'segredo',
      }),
    );

    await provider.send({ to: 'destino@exemplo.pt', subject: 'Olá', body: 'Corpo' });

    expect(mocks.mailSend).toHaveBeenCalledWith({
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      username: 'voce@exemplo.com',
      password: 'segredo',
      from: 'voce@exemplo.com',
      to: 'destino@exemplo.pt',
      subject: 'Olá',
      body: 'Corpo',
    });
  });

  it('sem servidor SMTP, recusa-se em vez de tentar o envio', async () => {
    const provider = new ImapMailProvider(
      settings({ imapServer: 'imap.gmail.com', username: 'u', password: 'p' }),
    );

    await expect(provider.send({ to: 'destino@exemplo.pt', subject: 'Olá', body: 'Corpo' })).rejects.toThrow(
      /servidor SMTP/i,
    );
    expect(mocks.mailSend).not.toHaveBeenCalled();
  });
});
