import { AiFailure, failureFromStatus } from '@/types/ai-failure';
import type { AiProvider, AiRequest } from '@/types/assistant';
import { buildMessages } from './deepseek-provider';

/**
 * Claude, via API da Anthropic (Parte 12 §Orquestrador multi-provedor).
 *
 * Cumpre o mesmo contrato `AiProvider` que a DeepSeek e o `RuleProvider` —
 * streaming, cancelável por `AbortSignal`, falhas tipadas em vez de texto de
 * erro disfarçado de resposta. O que muda é o formato: a API da Anthropic não
 * é compatível com a da OpenAI, tem o seu próprio protocolo de eventos
 * (`content_block_delta` em vez de `choices[0].delta`).
 *
 * **Ainda não pede ferramentas** — só a DeepSeek o faz (`run()`), porque o
 * formato de ferramentas da Anthropic (blocos `tool_use`, argumentos que
 * chegam por `input_json_delta`) é uma peça própria, maior do que cabia nesta
 * primeira versão. Fica registado como o próximo passo, não escondido.
 *
 * **Ligado à janela de configurações** (`AiSettings.tsx`, Personalização →
 * Assistente): campo para a chave, seletor de modelo, e entra na cadeia
 * de fallback automática (`use-ai-settings-store.ts`, `CHAIN_ORDER`), a
 * seguir à DeepSeek. Ver `docs/spec/orquestrador-multi-provedor.md`.
 */

/** Modelos oferecidos — rápido para o dia a dia, profundo para raciocínio. */
export type ClaudeModelId = 'claude-sonnet-5' | 'claude-opus-5';

export const CLAUDE_MODELS: readonly { readonly id: ClaudeModelId; readonly name: string; readonly description: string }[] = [
  { id: 'claude-sonnet-5', name: 'Sonnet 5', description: 'Rápido, chega para conversa e comandos.' },
  { id: 'claude-opus-5', name: 'Opus 5', description: 'Pensa mais fundo. Mais lento e mais caro.' },
];

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 1_024;

interface ContentBlockDelta {
  readonly type: 'content_block_delta';
  readonly delta: { readonly type: string; readonly text?: string };
}

interface AnthropicErrorBody {
  readonly error?: { readonly type?: string; readonly message?: string };
}

export class ClaudeProvider implements AiProvider {
  readonly id = 'claude';
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

  setKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setModel(model: ClaudeModelId): void {
    this.model = model;
  }

  async *stream(request: AiRequest): AsyncIterable<string> {
    if (!this.isConfigured()) throw new AiFailure('configuracao');

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const onAbort = (): void => timeout.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const built = buildMessages(request);
      const system = built.find((message) => message.role === 'system')?.content ?? '';
      const messages = built
        .filter((message) => message.role !== 'system')
        .map((message) => ({ role: message.role, content: message.content }));

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
          system,
          messages,
          stream: true,
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw await claudeFailureFromResponse(response);
      if (!response.body) throw new AiFailure('vazio');

      yield* readClaudeStream(response.body, timeout.signal);
    } catch (error) {
      if (request.signal?.aborted) return;

      if (error instanceof AiFailure) throw error;
      throw new AiFailure(timeout.signal.aborted ? 'demora' : 'rede');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * A Anthropic não tem um código só para "sem saldo", ao contrário da DeepSeek
 * (402). Um crédito esgotado chega como 400 com uma mensagem de erro que fala
 * nisso — por isso inspeciona-se o corpo antes de cair no genérico.
 */
export async function claudeFailureFromResponse(response: Response): Promise<AiFailure> {
  if (response.status === 400) {
    try {
      const body = (await response.clone().json()) as AnthropicErrorBody;
      const message = body.error?.message?.toLowerCase() ?? '';
      if (message.includes('credit balance') || message.includes('saldo')) {
        return new AiFailure('saldo');
      }
    } catch {
      // Corpo ilegível — cai no genérico abaixo.
    }
  }

  return failureFromStatus(response.status);
}

/**
 * Lê o fluxo de eventos da Anthropic e devolve só o texto.
 *
 * Formato próprio: `content_block_delta` com `delta.type: 'text_delta'`, em
 * vez do `choices[0].delta.content` da OpenAI — por isso não reaproveita
 * `readStream` da DeepSeek, só o padrão de leitura por linhas.
 */
export async function* readClaudeStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const text = parseClaudeEventLine(line);
        if (text !== null) yield text;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** Uma linha do fluxo de eventos da Anthropic, ou `null` se não trouxer texto. */
export function parseClaudeEventLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;

  const payload = trimmed.slice(5).trim();
  if (payload.length === 0) return null;

  try {
    const chunk = JSON.parse(payload) as { readonly type?: string } & Partial<ContentBlockDelta>;
    if (chunk.type !== 'content_block_delta') return null;
    if (chunk.delta?.type !== 'text_delta') return null;

    return chunk.delta.text ?? null;
  } catch {
    return null;
  }
}
