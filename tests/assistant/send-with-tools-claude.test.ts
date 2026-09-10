import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService } from '@/services/ai-service';
import { ClaudeProvider } from '@/services/ai-providers/claude-provider';
import { setContextSource } from '@/services/assistant/context';
import { setToolExecutor, type ToolExecutor } from '@/services/assistant/tool-runner';
import { selectMessages, useAssistantStore } from '@/stores/use-assistant-store';

/**
 * `sendWithTools` com o Claude (Peça 20, extensão à Anthropic).
 *
 * A DeepSeek e a Ollama já cumprem este contrato (`deepseek.test.ts` e
 * `send-with-tools-ollama.test.ts`). Isto prova que o Claude entra no mesmo
 * caminho, apesar de o formato do fluxo ser completamente diferente — blocos
 * `tool_use`/`input_json_delta` em vez de `tool_calls` na `delta`.
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
    searchNotes: async () => [],
    readNote: async () => null,
    writeNote: async () => true,
    searchWeb: async () => ({ isSimulated: false, results: [] }),
    openWebPage: async () => 'desligado',
    openExternalUrl: async () => 'desligado',
    openPath: () => 'desligado',
    moveMouse: () => 'desligado',
    clickAt: () => 'desligado',
    typeText: () => 'desligado',
    seeScreen: async () => 'desligado',
    music: () => undefined,
    speak: () => undefined,
    setAutomationEnabled: () => true,
    runAutomation: () => true,
    clearConversations: () => undefined,
    forgetMemory: () => undefined,
    resetWidgets: () => undefined,
  };
}

function textDelta(index: number, text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } })}\n\n`;
}

function toolUseStart(index: number, id: string, name: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_start', index, content_block: { type: 'tool_use', id, name } })}\n\n`;
}

function toolUseDelta(index: number, partialJson: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: partialJson } })}\n\n`;
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

describe('Claude com ferramentas', () => {
  it('manda o pedido com ferramentas, e executa a que o modelo pediu', async () => {
    const executor = makeExecutor();
    const cleanup = setToolExecutor(executor);

    const fetchImpl = fetchSequence(
      streamOf(
        textDelta(0, 'Vou avisar. '),
        toolUseStart(1, 'call_1', 'notificar'),
        toolUseDelta(1, '{"titulo":"Oi",'),
        toolUseDelta(1, '"descricao":"Teste"}'),
      ),
      streamOf(textDelta(0, 'Feito.')),
    );

    const provider = new ClaudeProvider('sk-ant-teste', 'claude-sonnet-5', fetchImpl);
    const service = new AIService(provider);

    const pending = await service.sendWithTools('avisa-me com uma notificação');

    expect(pending).toEqual([]);
    expect(executor.calls).toContain('notificar:Oi:Teste');

    const last = selectMessages(useAssistantStore.getState()).at(-1);
    expect(last?.text).toBe('Feito.');

    cleanup();
  });

  it('manda o campo tools no formato da Anthropic (input_schema, sem function)', async () => {
    const cleanup = setToolExecutor(makeExecutor());
    const fetchImpl = fetchSequence(streamOf(textDelta(0, 'sem ferramentas nenhumas')));
    const provider = new ClaudeProvider('sk-ant-teste', 'claude-sonnet-5', fetchImpl);
    const service = new AIService(provider);

    await service.sendWithTools('olá');

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as {
      tools?: readonly { name: string; input_schema: unknown }[];
    };

    expect(sent.tools).toBeDefined();
    expect(sent.tools!.length).toBeGreaterThan(0);
    expect(sent.tools![0]!.input_schema).toBeDefined();

    cleanup();
  });

  it('a segunda volta manda a resposta da ferramenta como tool_result, na mensagem user seguinte', async () => {
    const cleanup = setToolExecutor(makeExecutor());

    const fetchImpl = fetchSequence(
      streamOf(toolUseStart(0, 'call_1', 'notificar'), toolUseDelta(0, '{"titulo":"Oi","descricao":"Teste"}')),
      streamOf(textDelta(0, 'Feito.')),
    );

    const provider = new ClaudeProvider('sk-ant-teste', 'claude-sonnet-5', fetchImpl);
    const service = new AIService(provider);
    await service.sendWithTools('avisa-me');

    const [, secondInit] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[1] as [string, RequestInit];
    const sentMessages = (JSON.parse(secondInit.body as string) as { messages: unknown[] }).messages;

    const toolResultMessage = sentMessages.find(
      (message) =>
        (message as { role: string }).role === 'user' &&
        Array.isArray((message as { content: unknown }).content) &&
        ((message as { content: { type: string }[] }).content).some((block) => block.type === 'tool_result'),
    ) as { content: { type: string; tool_use_id: string; content: string }[] } | undefined;

    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage!.content[0]!.tool_use_id).toBe('call_1');

    cleanup();
  });
});
