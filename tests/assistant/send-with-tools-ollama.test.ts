import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService } from '@/services/ai-service';
import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
import { setContextSource } from '@/services/assistant/context';
import { setToolExecutor, type ToolExecutor } from '@/services/assistant/tool-runner';
import { selectMessages, useAssistantStore } from '@/stores/use-assistant-store';

/**
 * `sendWithTools` com a Ollama (Parte 12 §Ferramentas, extensão à Ollama).
 *
 * A DeepSeek já cumpre este contrato (`ai-providers/deepseek.test.ts`
 * cobre o parser). Isto prova que a Ollama, quando o modelo suportar
 * ferramentas, entra no mesmo caminho — e que, quando não suportar, cai
 * para um envio normal, sem tentar pedir ferramentas a um modelo que não
 * sabe usá-las.
 */

const CONTEXT = {
  now: new Date('2026-08-13T10:00:00Z'),
  openWindows: [],
  unreadNotifications: 0,
  systemState: 'normal' as const,
  theme: 'classic' as const,
  userName: 'Anderson',
  weather: null,
  tasks: { total: 0, done: 0 },
};

function makeExecutor(): ToolExecutor & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    openWindow: () => undefined,
    closeWindow: () => undefined,
    closeAllWindows: () => undefined,
    setTheme: () => undefined,
    setWallpaper: () => undefined,
    setSystemState: () => undefined,
    setWidgetVisible: () => undefined,
    goToDesktop: () => undefined,
    applyLayout: () => true,
    saveLayout: () => undefined,
    createTask: () => undefined,
    completeTask: () => true,
    clearDoneTasks: () => 0,
    notify: (title, description) => void calls.push(`notificar:${title}:${description}`),
    search: () => undefined,
    searchFiles: () => [],
    openFileLocation: () => true,
    music: () => undefined,
    speak: () => undefined,
    setAutomationEnabled: () => true,
    runAutomation: () => true,
    clearConversations: () => undefined,
    forgetMemory: () => undefined,
    resetWidgets: () => undefined,
  };
}

function event(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

function toolCallEvent(id: string, name: string, args: string): string {
  return `data: ${JSON.stringify({
    choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: args } }] } }],
  })}\n`;
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

/** Uma sequência de respostas — uma por chamada ao `fetch`, pela ordem. */
function fetchSequence(...bodies: readonly ReadableStream<Uint8Array>[]): typeof fetch {
  let call = 0;
  return vi.fn(async (): Promise<Response> => {
    const body = bodies[Math.min(call, bodies.length - 1)];
    call += 1;
    return { ok: true, status: 200, body } as Response;
  });
}

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
  setContextSource(() => CONTEXT);
});

describe('modelo capaz de ferramentas (qwen3)', () => {
  it('manda o pedido com ferramentas, e executa a que o modelo pediu', async () => {
    const executor = makeExecutor();
    const cleanup = setToolExecutor(executor);

    const fetchImpl = fetchSequence(
      streamOf(
        event('Vou avisar. '),
        toolCallEvent('call_1', 'notificar', '{"titulo":"Oi","descricao":"Teste"}'),
      ),
      streamOf(event('Feito.')),
    );

    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);
    const service = new AIService(provider);

    const pending = await service.sendWithTools('avisa-me com uma notificação');

    expect(pending).toEqual([]);
    expect(executor.calls).toContain('notificar:Oi:Teste');

    const last = selectMessages(useAssistantStore.getState()).at(-1);
    expect(last?.text).toBe('Feito.');

    cleanup();
  });

  it('manda o campo tools no pedido — confirma-se pelo corpo enviado', async () => {
    const cleanup = setToolExecutor(makeExecutor());
    const fetchImpl = fetchSequence(streamOf(event('sem ferramentas nenhumas')));
    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);
    const service = new AIService(provider);

    await service.sendWithTools('olá');

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as { tools?: unknown };
    expect(sent.tools).toBeDefined();

    cleanup();
  });
});

describe('modelo sem ferramentas conhecidas (llama2)', () => {
  it('nunca manda o campo tools — cai para um envio normal', async () => {
    const cleanup = setToolExecutor(makeExecutor());
    const fetchImpl = fetchSequence(streamOf(event('resposta normal, sem ferramentas')));
    const provider = new OllamaProvider('llama2', 'http://localhost:11434', fetchImpl);
    const service = new AIService(provider);

    const pending = await service.sendWithTools('faz alguma coisa');

    expect(pending).toEqual([]);

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as { tools?: unknown };
    expect(sent.tools).toBeUndefined();

    const last = selectMessages(useAssistantStore.getState()).at(-1);
    expect(last?.text).toBe('resposta normal, sem ferramentas');

    cleanup();
  });
});
