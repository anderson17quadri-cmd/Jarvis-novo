import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService } from '@/services/ai-service';
import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
import { setContextSource } from '@/services/assistant/context';
import { setToolExecutor, type ToolExecutor } from '@/services/assistant/tool-runner';
import { useAssistantStore } from '@/stores/use-assistant-store';

/**
 * Fala por frase no caminho com ferramentas (item 18, reportado ao vivo).
 *
 * A janela normal do assistente responde pelo `sendWithTools`, que nunca
 * expunha o streaming — por isso nunca falava, ao contrário do caminho dos
 * comandos por voz (`ask`, que usa `send(prompt, onChunk)`). Prova-se aqui
 * que `onChunk` agora chega ao chamador, nos dois caminhos: quando o provedor
 * sabe pedir ferramentas, e quando não sabe (e cai no envio normal).
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

function makeExecutor(): ToolExecutor {
  return {
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

describe('sendWithTools expõe o streaming (onChunk)', () => {
  it('no provedor capaz de ferramentas, recebe o texto de cada ronda', async () => {
    const cleanup = setToolExecutor(makeExecutor());
    const fetchImpl = fetchSequence(
      streamOf(
        event('Vou avisar. '),
        toolCallEvent('call_1', 'notificar', '{"titulo":"Oi","descricao":"Teste"}'),
      ),
      streamOf(event('Feito.')),
    );

    const provider = new OllamaProvider('qwen3:8b', 'http://localhost:11434', fetchImpl);
    const service = new AIService(provider);

    const recebido: string[] = [];
    await service.sendWithTools('avisa-me com uma notificação', (chunk) => recebido.push(chunk));

    expect(recebido.join('')).toBe('Vou avisar. Feito.');
    cleanup();
  });

  it('no provedor sem ferramentas, cai no envio normal e o onChunk chega na mesma', async () => {
    const cleanup = setToolExecutor(makeExecutor());
    const fetchImpl = fetchSequence(streamOf(event('resposta normal, sem ferramentas')));
    const provider = new OllamaProvider('llama2', 'http://localhost:11434', fetchImpl);
    const service = new AIService(provider);

    const recebido: string[] = [];
    await service.sendWithTools('faz alguma coisa', (chunk) => recebido.push(chunk));

    expect(recebido.join('')).toBe('resposta normal, sem ferramentas');
    cleanup();
  });
});
