import { describe, expect, it, vi } from 'vitest';

import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
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
