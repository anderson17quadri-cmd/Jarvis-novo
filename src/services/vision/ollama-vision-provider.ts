import { AiFailure, failureFromStatus } from '@/types/ai-failure';
import { DEFAULT_OLLAMA_BASE_URL } from '../ai-providers/ollama-provider';
import { VISION_PROMPT, type VisionProvider } from './vision-provider';

/**
 * Um modelo de visão local via Ollama (Fase 3.5).
 *
 * Usa o ponto de entrada nativo `/api/chat` (e não o compatível com a OpenAI)
 * porque a Ollama o documenta como a maneira de mandar imagens: um bloco
 * `images` com o base64 dentro da mensagem. O print **nunca sai da máquina** —
 * é o próprio dispositivo a descrever-se a si mesmo.
 *
 * O modelo de visão é à parte do modelo de texto de propósito: um `llama3.1`
 * sabe conversar mas não vê; um `llava` (ou `qwen2.5-vl`, ou `llama3.2-vision`)
 * vê mas não é o melhor para conversa. Por isso há um campo próprio nas
 * definições, `ollamaVisionModel`.
 */

const TIMEOUT_MS = 30_000;

/** Um modelo em falta no `/api/chat` vem com `{"error":"model 'x' not found"}` — sem o `type` aninhado do `/v1`. */
async function ollamaVisionFailure(response: Response): Promise<AiFailure> {
  if (response.status === 404) {
    try {
      const body = (await response.json()) as { error?: string | { type?: string } };
      const error = body.error;
      if (typeof error === 'string' && error.includes('not found')) return new AiFailure('modelo');
      if (typeof error === 'object' && error !== null && error.type === 'not_found_error') {
        return new AiFailure('modelo');
      }
    } catch {
      // Corpo ilegível — cai no genérico abaixo.
    }
  }
  return failureFromStatus(response.status);
}

export class OllamaVisionProvider implements VisionProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Ollama';
  readonly isRemote = false;

  constructor(
    private model: string,
    private readonly baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
    /** Injetável para os testes correrem sem rede. */
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  isConfigured(): boolean {
    return this.model.trim().length > 0;
  }

  async describe(imageBase64: string, signal?: AbortSignal): Promise<string> {
    if (!this.isConfigured()) throw new AiFailure('configuracao');

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const onAbort = (): void => timeout.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [{ role: 'user', content: VISION_PROMPT, images: [imageBase64] }],
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw await ollamaVisionFailure(response);

      const body = (await response.json()) as { message?: { content?: string } };
      const text = body.message?.content?.trim() ?? '';
      if (text.length === 0) throw new AiFailure('vazio');
      return text;
    } catch (error) {
      if (signal?.aborted) return '';
      if (error instanceof AiFailure) throw error;
      throw new AiFailure(timeout.signal.aborted ? 'demora' : 'rede');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
