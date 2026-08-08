import { AiFailure, failureFromStatus } from '@/types/ai-failure';
import type { AiProvider, AiRequest } from '@/types/assistant';
import { buildMessages, readStream } from './deepseek-provider';

/**
 * Um modelo local via Ollama (Parte 12 §Orquestrador multi-provedor).
 *
 * Cumpre o mesmo contrato `AiProvider` que os outros. A diferença que importa
 * está em `isConfigured()`: não há chave nenhuma a validar, porque não há
 * ninguém do outro lado a cobrar — é o próprio dispositivo a responder-se a
 * si mesmo em `localhost`. O endereço da API expõe-se aqui de propósito
 * (`baseUrl`), ao contrário da DeepSeek e da Claude, cujo endereço é fixo:
 * quem instala o Ollama escolhe a porta, e às vezes muda-a.
 *
 * O ponto de entrada `/v1/chat/completions` do Ollama é **compatível com a
 * OpenAI** de propósito — por isso reaproveita-se `readStream` e
 * `buildMessages` da DeepSeek em vez de reescrever o mesmo parser.
 *
 * **Não sabe se o modelo que lhe pedires existe.** Isso depende do que foi
 * feito `ollama pull` na máquina — não é algo que o código possa validar sem
 * perguntar ao Ollama primeiro, e por isso um modelo em falta chega como um
 * 404 qualquer, tratado como problema genérico do servidor (`failureFromStatus`
 * já faz isso para códigos que não reconhece).
 *
 * **Não está ligado à janela de configurações.** Mesma nota do
 * `claude-provider.ts` — existe e está testado, falta a cadeia à volta.
 */

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

const TIMEOUT_MS = 60_000;

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';

  constructor(
    private model: string,
    private readonly baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
    /** Injetável para os testes correrem sem rede. */
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  /** Sempre `true` com um nome de modelo — não há chave para validar. */
  isConfigured(): boolean {
    return this.model.trim().length > 0;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async *stream(request: AiRequest): AsyncIterable<string> {
    if (!this.isConfigured()) throw new AiFailure('configuracao');

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const onAbort = (): void => timeout.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: buildMessages(request),
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw failureFromStatus(response.status);
      if (!response.body) throw new AiFailure('vazio');

      yield* readStream(response.body, timeout.signal);
    } catch (error) {
      if (request.signal?.aborted) return;

      if (error instanceof AiFailure) throw error;

      /*
       * Sem servidor Ollama a correr, `fetch` nem chega a devolver um estado
       * HTTP — atira logo um erro de rede. É o caso mais comum de falha aqui,
       * ao contrário da DeepSeek e da Claude: não é a internet que falta, é o
       * Ollama que ainda não foi ligado.
       */
      throw new AiFailure(timeout.signal.aborted ? 'demora' : 'rede');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}
