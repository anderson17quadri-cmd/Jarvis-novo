import type { AiProvider, AiRequest } from '@/types/assistant';

export type { AiProvider, AiRequest };

/**
 * Provedor simulado — o único ativo na Fase 1.
 *
 * Responde com frases fixas, mas pela mesma interface que um provedor real vai
 * usar: streaming pedaço a pedaço, cancelável por `AbortSignal`. É isso que
 * permite trocar por OpenAI, Claude ou Ollama sem tocar em componente nenhum.
 */
const MOCK_REPLIES = [
  'Registei o pedido. Os agentes de pesquisa e de execução estão em fila; devolvo o resultado assim que terminarem.',
  'Consultei o contexto do sistema. Recomendo tratar disso depois do bloco de trabalho das 16:00, para não partir a sessão de foco.',
  'Concluído. Guardei nas suas notas e liguei o item ao projeto correspondente.',
  'Encontrei quatro resultados relevantes. Quer um resumo ou avanço já para a execução?',
] as const;

/** Ritmo da escrita simulada, por carácter. */
const CHUNK_DELAY_MS = 14;
const CHUNK_JITTER_MS = 20;

export class MockProvider implements AiProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  private replyIndex = 0;

  isConfigured(): boolean {
    return true;
  }

  async *stream(request: AiRequest): AsyncIterable<string> {
    const reply = MOCK_REPLIES[this.replyIndex % MOCK_REPLIES.length] ?? MOCK_REPLIES[0];
    this.replyIndex += 1;

    // Pausa inicial: é o tempo em que o núcleo mostra "a analisar".
    await delay(800 + Math.random() * 700, request.signal);

    for (const character of reply) {
      if (request.signal?.aborted) return;
      await delay(CHUNK_DELAY_MS + Math.random() * CHUNK_JITTER_MS, request.signal);
      yield character;
    }
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
