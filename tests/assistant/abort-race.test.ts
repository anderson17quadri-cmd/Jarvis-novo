import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService } from '@/services/ai-service';
import { setContextSource } from '@/services/assistant/context';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AiProvider } from '@/types/assistant';

/**
 * Corrida de cancelamento no `AIService` (revisão a sério do orquestrador,
 * 14/08/2026).
 *
 * O fim de um `send()` cancelado corria por cima do pedido novo: repunha o
 * modo a "idle" e — pior — fazia `this.controller = null` por cima do
 * controller do pedido que acabara de começar. Resultado observável: um
 * terceiro pedido deixa de conseguir cancelar o segundo, e duas respostas
 * passam a escrever na conversa ao mesmo tempo.
 */

const CONTEXT = {
  now: new Date('2026-08-14T10:00:00Z'),
  openWindows: [],
  unreadNotifications: 0,
  systemState: 'normal' as const,
  theme: 'classic' as const,
  userName: 'Anderson',
  weather: null,
  tasks: { total: 0, done: 0 },
};

/** Um provedor cujo `stream` emite um pedaço e depois fica à espera de ser
 *  cancelado (ou de se soltar à mão). Regista o `signal` de cada chamada. */
function makeProvider(): {
  provider: AiProvider;
  calls: Array<{ signal: AbortSignal | undefined }>;
} {
  const calls: Array<{ signal: AbortSignal | undefined }> = [];

  const provider: AiProvider = {
    id: 'ctrl',
    name: 'ctrl',
    isRemote: false,
    isConfigured: () => true,
    async *stream(request) {
      calls.push({ signal: request.signal });
      yield 'início ';
      // Bloqueia até o pedido ser cancelado. Nada mais é emitido — o que
      // interessa é quando o `signal` é abortado.
      await new Promise<void>((resolve) => {
        request.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
      if (request.signal?.aborted) return;
      yield 'fim.';
    },
  };

  return { provider, calls };
}

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
  setContextSource(() => CONTEXT);
});

describe('cancelar um pedido não destrói o cancelamento do seguinte', () => {
  it('um terceiro pedido ainda cancela o segundo', async () => {
    const { provider, calls } = makeProvider();
    const service = new AIService(provider);

    const primeiro = service.send('primeiro');
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    const segundo = service.send('segundo');
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    // Deixa o primeiro terminar (o seu `send` foi cancelado e chega ao fim).
    await primeiro;

    const terceiro = service.send('terceiro');
    await vi.waitFor(() => expect(calls).toHaveLength(3));

    // O segundo foi cancelado pelo terceiro — é o que se espera de um
    // controller são. Com o bug, o fim do primeiro apagava o controller do
    // segundo, e este `aborted` ficava a `false`.
    expect(calls[1]?.signal?.aborted).toBe(true);

    // Limpeza: cancela o terceiro, para os `send`s pendentes terminarem em
    // vez de ficarem à espera de um abort que nunca chega.
    service.cancel();
    await segundo;
    await terceiro;
  });
});
