import { describe, expect, it } from 'vitest';

import { answerFromContext } from '@/services/ai-providers/rule-provider';
import type { AssistantContext, AssistantMemory } from '@/types/assistant';

const EMPTY_MEMORY: AssistantMemory = { preferences: {}, recentPrompts: [] };

function makeContext(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    now: new Date(2026, 6, 28, 14, 30),
    userName: 'Anderson',
    weather: { location: 'Porto', temperatureC: 21, label: 'Céu limpo' },
    openWindows: ['Emails'],
    unreadNotifications: 2,
    systemState: 'normal',
    theme: 'classic',
    ...overrides,
  };
}

describe('responder com o contexto', () => {
  it('diz as horas', () => {
    expect(answerFromContext('Que horas são?', makeContext(), EMPTY_MEMORY)).toBe('São 14:30.');
  });

  it('a pergunta com acentos e a sem acentos dão a mesma resposta', () => {
    const context = makeContext();
    expect(answerFromContext('que horas sao', context, EMPTY_MEMORY)).toBe(
      answerFromContext('Que horas são?', context, EMPTY_MEMORY),
    );
  });

  it('diz o tempo', () => {
    expect(answerFromContext('Como está o tempo?', makeContext(), EMPTY_MEMORY)).toBe(
      'Em Porto estão 21° e céu limpo.',
    );
  });

  it('sem leitura de meteorologia, diz porquê em vez de inventar um número', () => {
    const answer = answerFromContext('e o clima?', makeContext({ weather: null }), EMPTY_MEMORY);

    expect(answer).toContain('Ainda não recebi leitura');
    expect(answer).toContain('rede');
  });

  it('lista as janelas abertas', () => {
    expect(answerFromContext('que janelas tenho abertas', makeContext(), EMPTY_MEMORY)).toBe(
      'Tem aberta a janela Emails.',
    );
  });

  it('sem janelas nenhumas diz isso mesmo', () => {
    expect(
      answerFromContext('que janelas tenho', makeContext({ openWindows: [] }), EMPTY_MEMORY),
    ).toBe('Não tem nenhuma janela aberta.');
  });

  it('conta as notificações', () => {
    expect(answerFromContext('tenho notificações?', makeContext(), EMPTY_MEMORY)).toBe(
      'Tem 2 notificações por ler.',
    );
  });

  it('diz o estado e o tema', () => {
    const answer = answerFromContext(
      'em que modo estou',
      makeContext({ systemState: 'foco', theme: 'oled' }),
      EMPTY_MEMORY,
    );

    expect(answer).toBe('O sistema está em modo foco, com o tema oled.');
  });

  it('a saudação usa a hora e o nome', () => {
    const answer = answerFromContext('olá', makeContext(), EMPTY_MEMORY);

    expect(answer).toContain('Boa tarde, Anderson.');
    expect(answer).toContain('São 14:30.');
  });

  it('o nome guardado na memória vale mais do que o da sessão', () => {
    const answer = answerFromContext('olá', makeContext(), {
      preferences: { nome: 'Quadri' },
      recentPrompts: [],
    });

    expect(answer).toContain('Boa tarde, Quadri.');
  });
});

describe('responder com a memória', () => {
  it('confirma uma preferência acabada de dizer, com acentos e tudo', () => {
    const answer = answerFromContext('Trata-me por André', makeContext(), EMPTY_MEMORY);

    expect(answer).toContain('André');
    expect(answer).toContain('Fica no dispositivo');
  });

  it('conta o que sabe', () => {
    const answer = answerFromContext('de que te lembras?', makeContext(), {
      preferences: { nome: 'Anderson' },
      recentPrompts: ['abre os emails'],
    });

    expect(answer).toContain('Anderson');
    expect(answer).toContain('abre os emails');
  });

  it('sem memória nenhuma, explica como se lhe dá uma', () => {
    const answer = answerFromContext('de que te lembras?', makeContext(), EMPTY_MEMORY);

    expect(answer).toContain('Ainda não guardei nada');
  });
});

describe('o que não sabe', () => {
  it('devolve nulo em vez de uma resposta inventada', () => {
    expect(
      answerFromContext('escreve-me um poema sobre o mar', makeContext(), EMPTY_MEMORY),
    ).toBeNull();
  });

  it('sem contexto nenhum não responde a perguntas sobre o presente', () => {
    expect(answerFromContext('que horas são', null, EMPTY_MEMORY)).toBeNull();
  });

  it('mas a memória responde mesmo sem contexto', () => {
    expect(answerFromContext('de que te lembras', null, EMPTY_MEMORY)).not.toBeNull();
  });

  it('um pedido vazio não é pergunta nenhuma', () => {
    expect(answerFromContext('   ', makeContext(), EMPTY_MEMORY)).toBeNull();
  });
});
