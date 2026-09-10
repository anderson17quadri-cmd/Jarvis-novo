import { describe, expect, it } from 'vitest';

import {
  groupConversations,
  onlyWithFavourites,
  searchConversations,
} from '@/apps/assistant/conversation-history';
import { conversationToMarkdown, exportFileName } from '@/apps/assistant/export';
import type { AssistantConversation, AssistantMessage } from '@/types/assistant';

const NOW = new Date(2026, 6, 28, 12, 0).getTime();
const DAY = 24 * 60 * 60_000;

function message(text: string, overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    id: `msg-${text}`,
    author: 'user',
    text,
    createdAt: NOW,
    isStreaming: false,
    isFavourite: false,
    ...overrides,
  };
}

function conversation(
  title: string,
  overrides: Partial<AssistantConversation> = {},
): AssistantConversation {
  return {
    id: `conv-${title}`,
    title,
    createdAt: NOW,
    updatedAt: NOW,
    isPinned: false,
    messages: [message(title)],
    ...overrides,
  };
}

describe('categorias', () => {
  it('agrupa por tempo', () => {
    const groups = groupConversations(
      [
        conversation('hoje'),
        conversation('ontem', { updatedAt: NOW - DAY }),
        conversation('semana', { updatedAt: NOW - 3 * DAY }),
        conversation('velha', { updatedAt: NOW - 40 * DAY }),
      ],
      NOW,
    );

    expect(groups.map((group) => group.label)).toEqual([
      'Hoje',
      'Ontem',
      'Últimos 7 dias',
      'Mais antigas',
    ]);
  });

  it('as fixadas ficam num grupo à parte, no topo', () => {
    const groups = groupConversations(
      [conversation('normal'), conversation('fixa', { isPinned: true })],
      NOW,
    );

    expect(groups[0]?.label).toBe('Fixadas');
    expect(groups[0]?.conversations[0]?.title).toBe('fixa');
  });

  it('um grupo vazio não aparece', () => {
    const groups = groupConversations([conversation('hoje')], NOW);
    expect(groups).toHaveLength(1);
  });

  it('sem conversas nenhumas não há grupos', () => {
    expect(groupConversations([], NOW)).toEqual([]);
  });

  it('"ontem" é o dia de calendário, não 24 horas antes', () => {
    // Às 12:00 de hoje, uma conversa das 23:00 de ontem tem 13 horas — mas é
    // de ontem na mesma.
    const yesterdayEvening = new Date(2026, 6, 27, 23, 0).getTime();
    const groups = groupConversations([conversation('tarde', { updatedAt: yesterdayEvening })], NOW);

    expect(groups[0]?.label).toBe('Ontem');
  });
});

describe('pesquisa', () => {
  const conversations = [
    conversation('Abre os emails'),
    conversation('Tarefas', { messages: [message('cria uma tarefa para amanhã')] }),
  ];

  it('pelo título', () => {
    expect(searchConversations(conversations, 'emails')).toHaveLength(1);
  });

  it('pelo que foi escrito lá dentro', () => {
    expect(searchConversations(conversations, 'amanhã')[0]?.title).toBe('Tarefas');
  });

  it('sem texto devolve tudo', () => {
    expect(searchConversations(conversations, '  ')).toHaveLength(2);
  });
});

describe('favoritas', () => {
  it('só passam as que têm alguma marcada', () => {
    const favourites = onlyWithFavourites([
      conversation('sem'),
      conversation('com', { messages: [message('boa', { isFavourite: true })] }),
    ]);

    expect(favourites).toHaveLength(1);
    expect(favourites[0]?.title).toBe('com');
  });
});

describe('exportar', () => {
  const exported = conversation('Que horas são', {
    messages: [
      message('Que horas são'),
      message('São 14:30.', { author: 'assistant', isFavourite: true }),
    ],
  });

  it('põe o título, os autores e o texto', () => {
    const markdown = conversationToMarkdown(exported);

    expect(markdown).toContain('# Que horas são');
    expect(markdown).toContain('## Eu');
    expect(markdown).toContain('## Jarvis');
    expect(markdown).toContain('São 14:30.');
  });

  it('marca as favoritas', () => {
    expect(conversationToMarkdown(exported)).toContain('*(favorita)*');
  });

  it('o nome do ficheiro não leva acentos nem espaços', () => {
    expect(exportFileName(exported)).toBe('jarvis-que-horas-sao.md');
  });

  it('um título sem letras nenhumas ainda dá um nome válido', () => {
    expect(exportFileName(conversation('???'))).toBe('jarvis-conversa.md');
  });
});
