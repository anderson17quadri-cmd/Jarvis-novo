import { describe, expect, it, vi } from 'vitest';

import {
  AiFailure,
  AI_FAILURE_REASONS,
  failureFromStatus,
  type AiFailureKind,
} from '@/types/ai-failure';

import {
  buildMessages,
  DeepSeekProvider,
  parseEventLine,
  readStream,
  systemPrompt,
} from '@/services/ai-providers/deepseek-provider';
import { looksLikeApiKey, maskApiKey } from '@/types/ai-provider-settings';
import type { AiRequest, AssistantContext, AssistantMemory } from '@/types/assistant';

const EMPTY_MEMORY: AssistantMemory = { preferences: {}, recentPrompts: [] };

function context(): AssistantContext {
  return {
    now: new Date(2026, 6, 28, 14, 30),
    userName: 'Anderson',
    weather: null,
    openWindows: ['Emails'],
    unreadNotifications: 1,
    systemState: 'normal',
    theme: 'classic',
  };
}

function request(overrides: Partial<AiRequest> = {}): AiRequest {
  return {
    prompt: 'que horas são',
    history: [],
    context: context(),
    memory: EMPTY_MEMORY,
    ...overrides,
  };
}

/** Um corpo de resposta com os eventos indicados, como a rede os entregaria. */
function streamOf(...chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/** Uma linha de evento com o texto pedido. */
function event(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

/** Um `fetch` que responde o que se lhe mandar, sem tocar na rede. */
function fakeFetch(response: Partial<Response>): typeof fetch {
  return vi.fn(async () => ({ ok: true, status: 200, body: null, ...response }) as Response);
}

describe('ler o fluxo de eventos', () => {
  it('tira o texto de uma linha normal', () => {
    expect(parseEventLine(event('Olá').trim())).toBe('Olá');
  });

  it('ignora o fim do fluxo', () => {
    expect(parseEventLine('data: [DONE]')).toBeNull();
  });

  it('ignora linhas vazias e comentários', () => {
    expect(parseEventLine('')).toBeNull();
    expect(parseEventLine(': keep-alive')).toBeNull();
  });

  it('uma linha malformada não parte a resposta inteira', () => {
    expect(parseEventLine('data: {isto não é json')).toBeNull();
  });

  it('um pedaço sem conteúdo devolve nulo em vez de "undefined"', () => {
    expect(parseEventLine('data: {"choices":[{"delta":{}}]}')).toBeNull();
  });

  it('o raciocínio do reasoner não se mostra — só a resposta', () => {
    expect(
      parseEventLine('data: {"choices":[{"delta":{"reasoning_content":"a pensar…"}}]}'),
    ).toBeNull();
  });
});

describe('montar a resposta', () => {
  it('junta os pedaços pela ordem em que chegam', async () => {
    const parts: string[] = [];
    for await (const part of readStream(streamOf(event('São '), event('14:30.')))) {
      parts.push(part);
    }

    expect(parts.join('')).toBe('São 14:30.');
  });

  it('um evento partido a meio pela rede não se perde', async () => {
    // O JSON chega cortado ao meio, como acontece a sério.
    const whole = event('Olá');
    const parts: string[] = [];

    for await (const part of readStream(streamOf(whole.slice(0, 20), whole.slice(20)))) {
      parts.push(part);
    }

    expect(parts.join('')).toBe('Olá');
  });

  it('para quando se cancela', async () => {
    const controller = new AbortController();
    controller.abort();

    const parts: string[] = [];
    for await (const part of readStream(streamOf(event('não devia aparecer')), controller.signal)) {
      parts.push(part);
    }

    expect(parts).toEqual([]);
  });
});

describe('o que se envia', () => {
  it('a personalidade da spec vai no pedido', () => {
    const prompt = systemPrompt(context(), EMPTY_MEMORY);

    expect(prompt).toContain('português de Portugal');
    expect(prompt).toContain('Nunca usas emojis');
    expect(prompt).toContain('dizes que não sabes');
  });

  it('o contexto do sistema vai junto', () => {
    expect(systemPrompt(context(), EMPTY_MEMORY)).toContain('São 14:30');
  });

  it('sem contexto não se inventa nenhum', () => {
    expect(systemPrompt(null, EMPTY_MEMORY)).not.toContain('Contexto de agora');
  });

  it('a memória vai, quando existe', () => {
    const prompt = systemPrompt(context(), {
      preferences: { nome: 'Quadri' },
      recentPrompts: [],
    });

    expect(prompt).toContain('Quadri');
  });

  it('a mensagem de sistema vem primeiro e o pedido por último', () => {
    const messages = buildMessages(request());

    expect(messages[0]?.role).toBe('system');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'que horas são' });
  });

  it('o histórico entra com os papéis certos', () => {
    const messages = buildMessages(
      request({
        history: [
          {
            id: '1',
            author: 'user',
            text: 'olá',
            createdAt: 0,
            isStreaming: false,
            isFavourite: false,
          },
          {
            id: '2',
            author: 'assistant',
            text: 'Boa tarde.',
            createdAt: 0,
            isStreaming: false,
            isFavourite: false,
          },
        ],
      }),
    );

    expect(messages[1]).toEqual({ role: 'user', content: 'olá' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Boa tarde.' });
  });

  it('a mensagem vazia que está a ser escrita não é enviada', () => {
    const messages = buildMessages(
      request({
        history: [
          { id: '1', author: 'assistant', text: '', createdAt: 0, isStreaming: true, isFavourite: false },
        ],
      }),
    );

    expect(messages).toHaveLength(2);
  });
});

describe('erros', () => {
  it.each([
    [401, 'chave'],
    [403, 'chave'],
    [402, 'saldo'],
    [429, 'limite'],
    [503, 'servidor'],
  ])('o código %i vira a falha "%s"', (status, kind) => {
    expect(failureFromStatus(status).kind).toBe(kind);
  });

  it('um código desconhecido conta como problema do servidor', () => {
    // A leitura mais provável, e a que leva a tentar outra vez em vez de
    // mandar a pessoa mexer numa chave que está boa.
    expect(failureFromStatus(418).kind).toBe('servidor');
  });

  it('toda a falha tem uma frase em português', () => {
    for (const kind of Object.keys(AI_FAILURE_REASONS) as AiFailureKind[]) {
      expect(new AiFailure(kind).message).toBe(AI_FAILURE_REASONS[kind]);
      expect(AI_FAILURE_REASONS[kind].length).toBeGreaterThan(0);
    }
  });
});

/** Consome um stream até ao fim, para se poder afirmar que ele lança. */
async function drain(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const part of stream) text += part;
  return text;
}

describe('o provedor', () => {
  it('sem chave não liga a lado nenhum, e falha em vez de fingir uma resposta', async () => {
    const fetchImpl = vi.fn();
    const provider = new DeepSeekProvider('', 'deepseek-chat', fetchImpl);

    await expect(drain(provider.stream(request()))).rejects.toMatchObject({
      kind: 'configuracao',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('manda a chave no cabeçalho e o modelo no corpo', async () => {
    // Guardar o pedido numa variável em vez de o ir buscar ao mock: assim o
    // tipo é o do `fetch` de verdade, e o teste falha se o contrato mudar.
    let sent: RequestInit | undefined;

    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = init;
      return { ok: true, status: 200, body: streamOf(event('Olá')) } as Response;
    };

    const provider = new DeepSeekProvider('sk-teste12345', 'deepseek-reasoner', fetchImpl);
    for await (const _ of provider.stream(request())) void _;

    expect(sent).toBeDefined();
    const headers = sent!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-teste12345');

    const body = JSON.parse(sent!.body as string) as { model: string; stream: boolean };
    expect(body.model).toBe('deepseek-reasoner');
    expect(body.stream).toBe(true);
  });

  it('uma recusa do servidor lança, em vez de entrar na conversa como resposta', async () => {
    const provider = new DeepSeekProvider(
      'sk-teste12345',
      'deepseek-chat',
      fakeFetch({ ok: false, status: 401 }),
    );

    // Antes, isto escrevia "A chave não foi aceite" no histórico com o mesmo
    // aspeto de tudo o resto, e ninguém a jusante sabia que nada tinha
    // corrido bem. Uma falha tem de se distinguir de uma resposta.
    await expect(drain(provider.stream(request()))).rejects.toMatchObject({ kind: 'chave' });
  });

  it('a rede em baixo lança como falha de rede', async () => {
    const provider = new DeepSeekProvider('sk-teste12345', 'deepseek-chat', () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(drain(provider.stream(request()))).rejects.toMatchObject({ kind: 'rede' });
  });

  it('cancelar não produz mensagem de erro nenhuma', async () => {
    const controller = new AbortController();
    controller.abort();

    const provider = new DeepSeekProvider('sk-teste12345', 'deepseek-chat', () => {
      throw new Error('aborted');
    });

    const parts: string[] = [];
    for await (const part of provider.stream(request({ signal: controller.signal }))) {
      parts.push(part);
    }

    expect(parts).toEqual([]);
  });
});

describe('a chave', () => {
  it('reconhece-se pelo formato', () => {
    expect(looksLikeApiKey('sk-abcdefgh1234')).toBe(true);
    expect(looksLikeApiKey('a minha password')).toBe(false);
    expect(looksLikeApiKey('sk-curta')).toBe(false);
  });

  it('mostra-se sem se revelar', () => {
    const masked = maskApiKey('sk-abcdefghijklmnop');

    expect(masked).toContain('…');
    expect(masked).not.toContain('defghijkl');
    expect(masked.endsWith('mnop')).toBe(true);
  });

  it('uma chave curta esconde-se por inteiro', () => {
    expect(maskApiKey('sk-123')).not.toContain('123');
  });
});
