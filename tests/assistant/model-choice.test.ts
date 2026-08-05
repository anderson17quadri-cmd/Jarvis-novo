import { describe, expect, it } from 'vitest';

import { DeepSeekProvider } from '@/services/ai-providers/deepseek-provider';
import {
  chooseModel,
  describeChoice,
  LONG_PROMPT_CHARS,
  MODEL_REASONS,
  type ModelReason,
} from '@/services/ai-providers/model-choice';
import { AiFailure } from '@/types/ai-failure';
import type { AiRequest } from '@/types/assistant';

/**
 * Seleção automática de modelo (Parte 12).
 *
 * A regra é uma função pura, e testa-se com strings. Depois prova-se que o
 * provedor a usa mesmo — no corpo do pedido, que é o único sítio onde isso se
 * pode verificar sem confiar em ninguém.
 */

function request(prompt: string): AiRequest {
  return {
    prompt,
    history: [],
    context: {
      now: new Date(2026, 7, 5, 10, 0),
      userName: 'Anderson',
      weather: null,
      openWindows: [],
      unreadNotifications: 0,
      systemState: 'normal',
      theme: 'classic',
    },
    memory: { preferences: {}, recentPrompts: [] },
  };
}

/**
 * Corre o stream até rebentar na falta de corpo.
 *
 * Apanha **só** a `AiFailure`. Um `catch` largo aqui chegou a esconder um
 * erro de tipos que rebentava antes do `fetch`, e o teste passava a afirmar
 * uma coisa que nunca chegou a acontecer.
 */
async function drainExpectingFailure(provider: DeepSeekProvider, prompt: string): Promise<void> {
  try {
    for await (const _ of provider.stream(request(prompt))) void _;
  } catch (error) {
    if (!(error instanceof AiFailure)) throw error;
  }
}

describe('a regra', () => {
  it('desligada, devolve sempre o que a pessoa escolheu', () => {
    for (const prompt of ['olá', 'explica-me a relatividade', 'corrige o código']) {
      const choice = chooseModel(prompt, 'deepseek-chat', false);

      expect(choice.model, prompt).toBe('deepseek-chat');
      expect(choice.reason, prompt).toBe('fixo');
    }
  });

  it.each([
    ['Porque é que o céu é azul?', 'raciocinio'],
    ['Explica-me como funciona um motor.', 'raciocinio'],
    ['Compara o React com o Vue.', 'raciocinio'],
    ['Resolve esta equação: 3x + 2 = 11', 'raciocinio'],
    ['Preciso disto passo a passo.', 'raciocinio'],
    ['Quais os prós e contras de mudar de casa?', 'raciocinio'],
  ])('%s pede raciocínio', (prompt, reason) => {
    const choice = chooseModel(prompt, 'deepseek-chat', true);

    expect(choice.model).toBe('deepseek-reasoner');
    expect(choice.reason).toBe(reason);
  });

  it.each([
    'Este código não compila.',
    'Escreve-me uma função que ordene isto.',
    'Que regex apanha um email?',
    'Corrige o erro que aparece no stack trace.',
    'Como faço isto em TypeScript?',
  ])('%s é sobre código', (prompt) => {
    const choice = chooseModel(prompt, 'deepseek-chat', true);

    expect(choice.model).toBe('deepseek-reasoner');
    expect(choice.reason).toBe('codigo');
  });

  it('um bloco de código denuncia-se sem palavra nenhuma', () => {
    const choice = chooseModel('```\nconst x = 1;\n```', 'deepseek-chat', true);

    expect(choice.reason).toBe('codigo');
  });

  it.each([
    'Olá!',
    'Bom dia.',
    'Que horas são?',
    'Abre os emails.',
    'Obrigado.',
  ])('%s chega para conversa', (prompt) => {
    const choice = chooseModel(prompt, 'deepseek-reasoner', true);

    // Repare-se no preferido: "reasoner". A escolha automática **também
    // desce** de modelo, e não só sobe — senão era só uma forma cara de
    // ignorar o que a pessoa escolheu.
    expect(choice.model).toBe('deepseek-chat');
    expect(choice.reason).toBe('conversa');
  });

  it('um pedido longo vai ao modelo que pensa, mesmo sem palavras-chave', () => {
    const longo = `${'preciso de uma lista de compras para a semana '.repeat(10)}`;
    expect(longo.length).toBeGreaterThan(LONG_PROMPT_CHARS);

    const choice = chooseModel(longo, 'deepseek-chat', true);

    expect(choice.model).toBe('deepseek-reasoner');
    expect(choice.reason).toBe('longo');
  });

  it('acentos e maiúsculas são indiferentes', () => {
    expect(chooseModel('EXPLICA-ME ISTO', 'deepseek-chat', true).model).toBe('deepseek-reasoner');
    expect(chooseModel('explica-me isto', 'deepseek-chat', true).model).toBe('deepseek-reasoner');
    expect(chooseModel('Qual a diferença?', 'deepseek-chat', true).model).toBe('deepseek-reasoner');
  });

  it('toda a razão tem uma frase, e a etiqueta junta nome e razão', () => {
    for (const reason of Object.keys(MODEL_REASONS) as ModelReason[]) {
      expect(MODEL_REASONS[reason].length).toBeGreaterThan(0);
    }

    expect(describeChoice({ model: 'deepseek-reasoner', reason: 'codigo' })).toBe(
      'Reasoner · a pergunta é sobre código',
    );
  });
});

describe('o provedor usa a escolha', () => {
  /** Devolve o modelo que foi mesmo pedido à API. */
  async function modelSent(
    prompt: string,
    pick?: (prompt: string) => { model: 'deepseek-chat' | 'deepseek-reasoner'; reason: ModelReason },
  ): Promise<string> {
    let sent = '';

    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = (JSON.parse(init?.body as string) as { model: string }).model;
      return { ok: true, status: 200, body: null } as unknown as Response;
    };

    const provider = new DeepSeekProvider('sk-teste12345', 'deepseek-chat', fetchImpl, pick);

    // O corpo vem `null` de propósito: interessa o que foi enviado, não o que
    // volta. A falha que isso provoca é esperada.
    await drainExpectingFailure(provider, prompt);

    return sent;
  }

  it('sem seletor, usa sempre o modelo do construtor', async () => {
    expect(await modelSent('explica-me tudo')).toBe('deepseek-chat');
  });

  it('com seletor, o modelo escolhido é o que vai no corpo do pedido', async () => {
    const pick = (prompt: string) => chooseModel(prompt, 'deepseek-chat', true);

    expect(await modelSent('olá', pick)).toBe('deepseek-chat');
    expect(await modelSent('explica-me a relatividade', pick)).toBe('deepseek-reasoner');
  });

  it('guarda a última escolha, para a resposta poder dizer qual foi', async () => {
    const provider = new DeepSeekProvider(
      'sk-teste12345',
      'deepseek-chat',
      async () => ({ ok: true, status: 200, body: null }) as unknown as Response,
      (prompt) => chooseModel(prompt, 'deepseek-chat', true),
    );

    expect(provider.choice).toBeNull();

    await drainExpectingFailure(provider, 'porque é que isto acontece?');

    expect(provider.choice).toEqual({ model: 'deepseek-reasoner', reason: 'raciocinio' });
  });
});
