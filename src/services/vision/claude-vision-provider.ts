import { AiFailure } from '@/types/ai-failure';
import {
  claudeFailureFromResponse,
  type ClaudeModelId,
} from '../ai-providers/claude-provider';
import { VISION_PROMPT, type VisionProvider } from './vision-provider';

/**
 * Claude com visão, via API da Anthropic (Fase 3.5).
 *
 * É a opção **remota**: o print sai do dispositivo e vai para os servidores da
 * Anthropic. Só entra em jogo por escolha explícita em Privacidade — a omissão
 * é o Ollama local, onde a imagem não sai da máquina.
 *
 * Reusa a chave e o modelo já configurados para o Claude de texto
 * (`claudeApiKey` / `claudeModel`): os modelos da família Claude 5 veem
 * imagens, por isso não há um modelo de visão separado para escolher — só a
 * decisão de privacidade de deixar o print sair.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 1_024;

export class ClaudeVisionProvider implements VisionProvider {
  readonly id = 'claude' as const;
  readonly name = 'Claude';
  readonly isRemote = true;

  constructor(
    private apiKey: string,
    private model: ClaudeModelId = 'claude-sonnet-5',
    /** Injetável para os testes correrem sem rede. */
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async describe(imageBase64: string, signal?: AbortSignal): Promise<string> {
    if (!this.isConfigured()) throw new AiFailure('configuracao');

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const onAbort = (): void => timeout.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: MAX_TOKENS,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
                },
                { type: 'text', text: VISION_PROMPT },
              ],
            },
          ],
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw await claudeFailureFromResponse(response);

      const body = (await response.json()) as {
        content?: readonly { type?: string; text?: string }[];
      };
      const text = (body.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text as string)
        .join('')
        .trim();
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
