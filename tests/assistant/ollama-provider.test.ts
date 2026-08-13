import { describe, expect, it, vi } from 'vitest';

import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
import { toolsAsJsonSchema } from '@/services/assistant/tools';
import type { AiRequest, AssistantContext, AssistantMemory } from '@/types/assistant';

const EMPTY_MEMORY: AssistantMemory = { preferences: {}, recentPrompts: [] };

function context(): AssistantContext {
  return {
    now: new Date(2026, 6, 28, 14, 30),
    userName: 'Anderson',
    weather: null,
    openWindows: [],
    unreadNotifications: 0,
    systemState: 'normal',
    theme: 'classic',
  };
}

function request(overrides: Partial<AiRequest> = {}): AiRequest {
  return { prompt: 'olá', history: [], context: context(), memory: EMPTY_MEMORY, ...overrides };
}

function streamOf(...chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function event(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

/** Um pedaço de `tool_calls`, como o Ollama manda no formato da OpenAI. */
function toolCallEvent(
  index: number,
  delta: { readonly id?: string; readonly name?: string; readonly args?: string },
): string {
  return `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index,
              id: delta.id,
              function: { name: delta.name, arguments: delta.args },
            },
          ],
        },
      },
    ],
  })}\n`;
}

function fakeFetch(response: {
  readonly ok?: boolean;
  readonly status?: number;
  readonly body?: ReadableStream<Uint8Array> | null;
}): typeof fetch {
  return vi.fn(async () => ({ ok: true, status: 200, body: null, ...response }) as Response);
}

describe('OllamaProvider', () => {
  it('está configurado com um nome de modelo, sem chave nenhuma', () => {
    expect(new OllamaProvider('llama3.1').isConfigured()).toBe(true);
    expect(new OllamaProvider('').isConfigured()).toBe(false);
  });

  it('junta os pedaços de texto pela ordem em que chegam', async () => {
    const body = streamOf(event('Olá, '), event('Anderson.'));
    const fetchImpl = fakeFetch({ body });
    const provider = new OllamaProvider('llama3.1', 'http://localhost:11434', fetchImpl);

    const parts: string[] = [];
    for await (const chunk of provider.stream(request())) parts.push(chunk);

    expect(parts.join('')).toBe('Olá, Anderson.');
  });

  it('fala com o endereço local, não com um servidor de terceiros', async () => {
    const body = streamOf();
    const fetchImpl = fakeFetch({ body });
    const provider = new OllamaProvider('llama3.1', 'http://localhost:11434', fetchImpl);

    for await (const _chunk of provider.stream(request())) void _chunk;

    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('respeita uma porta diferente da por omissão', async () => {
    const body = streamOf();
    const fetchImpl = fakeFetch({ body });
    const provider = new OllamaProvider('llama3.1', 'http://localhost:9999', fetchImpl);

    for await (const _chunk of provider.stream(request())) void _chunk;

    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('http://localhost:9999/v1/chat/completions');
  });

  it('sem o Ollama a correr, o erro de rede do fetch vira falha de rede, não um crash', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const provider = new OllamaProvider('llama3.1', 'http://localhost:11434', fetchImpl);

    await expect(async () => {
      for await (const _chunk of provider.stream(request())) void _chunk;
    }).rejects.toMatchObject({ kind: 'rede' });
  });

  it('um modelo que não existe localmente (404) cai no genérico de servidor', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 404 });
    const provider = new OllamaProvider('modelo-inexistente', 'http://localhost:11434', fetchImpl);

    await expect(async () => {
      for await (const _chunk of provider.stream(request())) void _chunk;
    }).rejects.toMatchObject({ kind: 'servidor' });
  });
});

describe('supportsToolCalling — palpite pelo nome do modelo', () => {
  it.each([
    'qwen3:8b',
    'qwen2.5:7b',
    'llama3.1',
    'llama3.1:70b',
    'llama3.2:3b',
    'llama3.3',
    'mistral',
    'mixtral:8x7b',
    'firefunction-v2',
    'command-r-plus',
  ])('%s é de uma família conhecida por suportar ferramentas', (model) => {
    expect(new OllamaProvider(model).supportsToolCalling()).toBe(true);
  });

  it.each(['llama2', 'llama2:13b', 'phi3', 'gemma2', 'codellama'])(
    '%s não é uma família conhecida — palpite honesto, não finge suporte',
    (model) => {
      expect(new OllamaProvider(model).supportsToolCalling()).toBe(false);
    },
  );

  it('sem modelo nenhum, não suporta nada', () => {
    expect(new OllamaProvider('').supportsToolCalling()).toBe(false);
  });

  it('não depende de maiúsculas/minúsculas', () => {
    expect(new OllamaProvider('QWEN3:8B').supportsToolCalling()).toBe(true);
  });
});

describe('run — a passagem com ferramentas', () => {
  it('manda o catálogo de ferramentas no pedido', async () => {
    const body = streamOf(event('tudo bem'));
    const fetchImpl = fakeFetch({ body });
    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);

    await provider.run(request(), [], () => undefined);

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as { tools?: unknown };
    expect(sent.tools).toEqual(toolsAsJsonSchema());
  });

  it('interpreta um pedido de ferramenta que chega partido em vários pedaços', async () => {
    const body = streamOf(
      event('Vou verificar. '),
      toolCallEvent(0, { id: 'call_1', name: 'procurar_ficheiro', args: '{"nome":"orça' }),
      toolCallEvent(0, { args: 'mento"}' }),
    );
    const fetchImpl = fakeFetch({ body });
    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);

    const chunks: string[] = [];
    const result = await provider.run(request(), [], (chunk) => chunks.push(chunk));

    expect(chunks.join('')).toBe('Vou verificar. ');
    expect(result.text).toBe('Vou verificar. ');
    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'procurar_ficheiro', args: { nome: 'orçamento' } },
    ]);
  });

  it('sem ferramenta nenhuma pedida, devolve uma lista vazia — não inventa uma', async () => {
    const body = streamOf(event('Só texto, sem ferramentas.'));
    const fetchImpl = fakeFetch({ body });
    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);

    const result = await provider.run(request(), [], () => undefined);

    expect(result.toolCalls).toEqual([]);
  });

  it('sem o Ollama a correr, falha como falha de rede — mesmo com ferramentas em jogo', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);

    await expect(provider.run(request(), [], () => undefined)).rejects.toMatchObject({
      kind: 'rede',
    });
  });
});
