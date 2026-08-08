import { describe, expect, it, vi } from 'vitest';

import { AiFailure } from '@/types/ai-failure';
import {
  ClaudeProvider,
  claudeFailureFromResponse,
  parseClaudeEventLine,
} from '@/services/ai-providers/claude-provider';
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
  return { prompt: 'que horas são', history: [], context: context(), memory: EMPTY_MEMORY, ...overrides };
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

/** Um evento `content_block_delta` como a Anthropic o manda. */
function textDelta(text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })}\n\n`;
}

function fakeFetch(response: {
  readonly ok?: boolean;
  readonly status?: number;
  readonly body?: ReadableStream<Uint8Array> | null;
}): typeof fetch {
  return vi.fn(async () => ({ ok: true, status: 200, body: null, ...response }) as Response);
}

describe('ler o fluxo de eventos da Anthropic', () => {
  it('tira o texto de um content_block_delta', () => {
    expect(parseClaudeEventLine(textDelta('Olá').trim())).toBe('Olá');
  });

  it('ignora outros tipos de evento (message_start, content_block_start…)', () => {
    const line = `data: ${JSON.stringify({ type: 'message_start', message: {} })}`;
    expect(parseClaudeEventLine(line)).toBeNull();
  });

  it('ignora um delta que não é texto', () => {
    const line = `data: ${JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'input_json_delta', partial_json: '{}' },
    })}`;
    expect(parseClaudeEventLine(line)).toBeNull();
  });

  it('uma linha malformada não parte a resposta inteira', () => {
    expect(parseClaudeEventLine('data: {isto não é json')).toBeNull();
  });
});

describe('ClaudeProvider', () => {
  it('sem chave, falha por configuração antes de tocar na rede', async () => {
    const fetchImpl = fakeFetch({});
    const provider = new ClaudeProvider('', 'claude-sonnet-5', fetchImpl);

    await expect(async () => {
      for await (const _chunk of provider.stream(request())) void _chunk;
    }).rejects.toThrow(AiFailure);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('junta os pedaços de texto pela ordem em que chegam', async () => {
    const body = streamOf(textDelta('São '), textDelta('14:30.'));
    const fetchImpl = fakeFetch({ body });
    const provider = new ClaudeProvider('sk-ant-teste', 'claude-sonnet-5', fetchImpl);

    const parts: string[] = [];
    for await (const chunk of provider.stream(request())) parts.push(chunk);

    expect(parts.join('')).toBe('São 14:30.');
  });

  it('manda a chave no cabeçalho certo, e o sistema separado das mensagens', async () => {
    const body = streamOf();
    const fetchImpl = fakeFetch({ body });
    const provider = new ClaudeProvider('sk-ant-teste', 'claude-opus-5', fetchImpl);

    for await (const _chunk of provider.stream(request())) void _chunk;

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-teste');
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body_ = JSON.parse(init.body as string) as { system: string; messages: unknown[]; model: string };
    expect(body_.model).toBe('claude-opus-5');
    expect(body_.system.length).toBeGreaterThan(0);
    expect(body_.messages.every((m) => (m as { role: string }).role !== 'system')).toBe(true);
  });

  it('401 vira falha de chave', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 401 });
    const provider = new ClaudeProvider('sk-ant-errada', 'claude-sonnet-5', fetchImpl);

    await expect(async () => {
      for await (const _chunk of provider.stream(request())) void _chunk;
    }).rejects.toMatchObject({ kind: 'chave' });
  });
});

describe('claudeFailureFromResponse', () => {
  it('um 400 com "credit balance" na mensagem vira falha de saldo', async () => {
    const response = {
      status: 400,
      clone: () => ({
        json: async () => ({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low.' } }),
      }),
    } as unknown as Response;

    const failure = await claudeFailureFromResponse(response);
    expect(failure.kind).toBe('saldo');
  });

  it('um 400 sem falar em saldo cai no genérico de servidor', async () => {
    const response = {
      status: 400,
      clone: () => ({ json: async () => ({ error: { message: 'campo em falta' } }) }),
    } as unknown as Response;

    const failure = await claudeFailureFromResponse(response);
    expect(failure.kind).toBe('servidor');
  });

  it('429 vira falha de limite, sem precisar de olhar para o corpo', async () => {
    const response = { status: 429 } as Response;
    const failure = await claudeFailureFromResponse(response);
    expect(failure.kind).toBe('limite');
  });
});
