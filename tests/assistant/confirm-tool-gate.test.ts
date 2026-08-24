import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService } from '@/services/ai-service';
import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
import { setContextSource } from '@/services/assistant/context';
import { setToolExecutor, type ToolCall, type ToolExecutor } from '@/services/assistant/tool-runner';
import { useAssistantStore } from '@/stores/use-assistant-store';

/**
 * `confirmTool` corre uma ferramenta com o sinalizador de "já confirmado"
 * ligado — é ele que salta a pergunta das ferramentas de risco `perde`.
 *
 * A porta tem de viver **dentro** do método, não na memória de quem chama. É
 * a mesma lição do `directControlService.executeStep`, corrigido em 13/08: o
 * comentário prometia "só a interface chama isto, e só depois de a pessoa
 * dizer que sim", e nada no código o impunha. Um caminho novo — um plugin,
 * uma automação, um atalho de voz — que chamasse `confirmTool` com um pedido
 * fabricado executava uma ferramenta destrutiva sem confirmação nenhuma.
 */

const CONTEXT = {
  now: new Date('2026-08-20T10:00:00Z'),
  openWindows: [],
  unreadNotifications: 0,
  systemState: 'normal' as const,
  theme: 'classic' as const,
  userName: 'Anderson',
  weather: null,
  tasks: { total: 2, done: 2 },
};

function makeExecutor(): ToolExecutor & { readonly apagou: () => number } {
  let vezes = 0;
  return {
    apagou: () => vezes,
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
    clearDoneTasks: () => {
      vezes += 1;
      return 2;
    },
    notify: () => undefined,
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

function fetchSequence(...bodies: readonly ReadableStream<Uint8Array>[]): typeof fetch {
  let call = 0;
  return vi.fn(async (): Promise<Response> => {
    const body = bodies[Math.min(call, bodies.length - 1)];
    call += 1;
    return { ok: true, status: 200, body } as Response;
  });
}

/** O modelo pede a ferramenta destrutiva; ela fica à espera de confirmação. */
async function pedirApagarTarefas(service: AIService): Promise<readonly ToolCall[]> {
  const fetchImpl = fetchSequence(
    streamOf(toolCallEvent('call_1', 'apagar_tarefas_concluidas', '{}')),
    streamOf(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Feito.' } }] })}\n`),
  );
  service.setProvider(new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl));

  const pending = await service.sendWithTools('apaga as tarefas concluídas');
  return pending.map((entry) => entry.call);
}

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
  setContextSource(() => CONTEXT);
});

describe('confirmTool — só executa o que esteve mesmo à espera de confirmação', () => {
  it('recusa uma chamada que nunca passou por uma confirmação pendente', async () => {
    const executor = makeExecutor();
    const cleanup = setToolExecutor(executor);
    const service = new AIService();

    const forjada: ToolCall = { id: 'forjada-1', name: 'apagar_tarefas_concluidas', args: {} };
    await service.confirmTool(forjada);

    expect(executor.apagou()).toBe(0);
    cleanup();
  });

  it('executa a chamada que o modelo pediu e a pessoa confirmou', async () => {
    const executor = makeExecutor();
    const cleanup = setToolExecutor(executor);
    const service = new AIService();

    const [call] = await pedirApagarTarefas(service);
    expect(call).toBeDefined();
    expect(executor.apagou()).toBe(0);

    await service.confirmTool(call as ToolCall);

    expect(executor.apagou()).toBe(1);
    cleanup();
  });

  it('a mesma confirmação não serve duas vezes', async () => {
    const executor = makeExecutor();
    const cleanup = setToolExecutor(executor);
    const service = new AIService();

    const [call] = await pedirApagarTarefas(service);
    await service.confirmTool(call as ToolCall);
    expect(executor.apagou()).toBe(1);

    // Um duplo clique, ou um reenvio, não volta a apagar: a confirmação
    // consome-se ao ser usada.
    await service.confirmTool(call as ToolCall);

    expect(executor.apagou()).toBe(1);
    cleanup();
  });
});
