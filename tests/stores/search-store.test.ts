import { beforeEach, describe, expect, it } from 'vitest';

import { useMailStore } from '@/stores/use-mail-store';
import { useNewsStore } from '@/stores/use-news-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useSearchStore } from '@/stores/use-search-store';
import type { MailboxSnapshot, MailMessage } from '@/types/mail';
import type { NewsFeed } from '@/types/news';

const MAIL: MailMessage = {
  id: 'm1',
  from: 'Barbearia Silva',
  fromAddress: 'geral@barbeariasilva.pt',
  subject: 'Pedido de demonstração',
  preview: 'Gostaríamos de ver o sistema.',
  body: 'Gostaríamos de ver o sistema em funcionamento.',
  folder: 'inbox',
  priority: 'acao',
  receivedAt: 1,
  isRead: false,
  isStarred: false,
  hasAttachments: false,
  attachments: [],
};

const FEED: NewsFeed = {
  articles: [
    {
      id: 'n1',
      title: 'Modelos locais aproximam-se da nuvem',
      summary: 'Testes independentes mostram diferenças menores.',
      source: 'Ciência Hoje',
      category: 'ciencia',
      publishedAt: 1,
      url: 'https://exemplo.pt/a',
      isRead: false,
      isFavorite: false,
    },
  ],
  fetchedAt: 1,
  isSimulated: true,
};

function snapshotWith(messages: readonly MailMessage[]): MailboxSnapshot {
  return {
    messages,
    unreadCount: messages.length,
    actionCount: messages.length,
    fetchedAt: 1,
    isSimulated: true,
  };
}

beforeEach(() => {
  localStorage.clear();
  useMailStore.setState({ snapshot: null, isLoading: true });
  useNewsStore.setState({ snapshot: null, isLoading: true });
  useNotificationStore.setState({ notifications: [] });
  useSearchStore.getState().setQuery('');
});

describe('pesquisa nos comandos', () => {
  it('encontra um comando pelo nome', () => {
    useSearchStore.getState().setQuery('personalizacao');

    expect(useSearchStore.getState().results[0]?.id).toBe('app:themes');
  });

  it('sem pesquisa aparecem os comandos, mas não o conteúdo', () => {
    useMailStore.setState({ snapshot: snapshotWith([MAIL]) });
    useSearchStore.getState().setQuery('');

    const groups = useSearchStore.getState().results.map((command) => command.group);
    expect(groups).toContain('Aplicações');
    expect(groups).not.toContain('Emails');
  });
});

describe('pesquisa no conteúdo das stores', () => {
  it('encontra um email que chegou à store depois de abrir', () => {
    useSearchStore.getState().setQuery('demonstracao');
    expect(useSearchStore.getState().results).toHaveLength(0);

    useMailStore.setState({ snapshot: snapshotWith([MAIL]) });
    useSearchStore.getState().setQuery('demonstracao');

    expect(useSearchStore.getState().results.some((command) => command.id === 'mail:m1')).toBe(
      true,
    );
  });

  it('encontra uma notícia pelo resumo', () => {
    useNewsStore.setState({ snapshot: FEED });
    useSearchStore.getState().setQuery('diferencas menores');

    expect(useSearchStore.getState().results.some((command) => command.id === 'news:n1')).toBe(
      true,
    );
  });
});

describe('subscrição das fontes', () => {
  it('recalcula os resultados quando uma fonte muda', () => {
    const dispose = useSearchStore.getState().hydrate();
    useSearchStore.getState().setQuery('prospeccao');
    expect(useSearchStore.getState().results).toHaveLength(0);

    useNotificationStore.getState().push('Automação concluída', 'Prospecção terminou.');

    expect(
      useSearchStore.getState().results.some((command) => command.id.startsWith('notif:')),
    ).toBe(true);
    dispose();
  });

  it('o cancelamento desliga as fontes', () => {
    const dispose = useSearchStore.getState().hydrate();
    useSearchStore.getState().setQuery('prospeccao');
    dispose();

    useNotificationStore.getState().push('Automação concluída', 'Prospecção terminou.');

    expect(useSearchStore.getState().results).toHaveLength(0);
  });
});
