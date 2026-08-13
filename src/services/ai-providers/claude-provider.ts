import { AiFailure, failureFromStatus } from '@/types/ai-failure';
import type { AiProvider, AiRequest } from '@/types/assistant';
import { buildMessages, type StreamResult } from './deepseek-provider';
import { toolsAsAnthropicSchema } from '../assistant/tools';
import type { ToolCall } from '../assistant/tool-runner';

/**
 * Claude, via API da Anthropic (Parte 12 §Orquestrador multi-provedor).
 *
 * Cumpre o mesmo contrato `AiProvider` que a DeepSeek e o `RuleProvider` —
 * streaming, cancelável por `AbortSignal`, falhas tipadas em vez de texto de
 * erro disfarçado de resposta. O que muda é o formato: a API da Anthropic não
 * é compatível com a da OpenAI, tem o seu próprio protocolo de eventos
 * (`content_block_delta` em vez de `choices[0].delta`).
 *
 * **Pede ferramentas** (`run()`, Peça 20) — a mesma extensão que a Ollama já
 * tinha ganho. O formato da Anthropic é mesmo diferente: um pedido de
 * ferramenta é um bloco `tool_use` dentro da própria mensagem `assistant`
 * (não um campo `tool_calls` à parte), a resposta é um bloco `tool_result`
 * dentro da mensagem `user` seguinte (não uma mensagem com `role: 'tool'`), e
 * os argumentos chegam a espalhar-se por vários eventos `input_json_delta`
 * antes de formarem JSON válido. `toAnthropicMessages` faz essa tradução a
 * partir do formato genérico (estilo OpenAI) que `ai-service.ts` já usa para
 * qualquer provedor — é o único sítio onde a diferença de formato importa.
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

/** Um evento do fluxo — só os campos que interessam a algum dos casos. */
interface AnthropicStreamEvent {
  readonly type: string;
  readonly index?: number;
  readonly content_block?: { readonly type: string; readonly id?: string; readonly name?: string };
  readonly delta?: { readonly type: string; readonly text?: string; readonly partial_json?: string };
}

interface AnthropicErrorBody {
  readonly error?: { readonly type?: string; readonly message?: string };
}

/** Um bloco de conteúdo de uma mensagem — texto, pedido ou resposta de ferramenta. */
interface AnthropicContentBlock {
  readonly type: 'text' | 'tool_use' | 'tool_result';
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
  readonly tool_use_id?: string;
  readonly content?: string;
}

interface AnthropicMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string | readonly AnthropicContentBlock[];
}

/** Uma mensagem no formato genérico (estilo OpenAI) que `ai-service.ts` monta. */
interface GenericMessage {
  readonly role: string;
  readonly content?: unknown;
  readonly tool_calls?: readonly {
    readonly id: string;
    readonly function: { readonly name: string; readonly arguments: string };
  }[];
  readonly tool_call_id?: string;
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
      const { system, messages } = toAnthropicMessages(buildMessages(request));

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

  /**
   * Uma passagem completa, com ferramentas (Peça 20) — o mesmo contrato que
   * `DeepSeekProvider.run()`, para o `AIService` poder tratar os dois
   * provedores da mesma forma em `sendWithTools`.
   */
  async run(
    request: AiRequest,
    messages: readonly unknown[],
    onText: (chunk: string) => void,
  ): Promise<StreamResult> {
    if (!this.isConfigured()) throw new AiFailure('configuracao');

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const onAbort = (): void => timeout.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const translated = toAnthropicMessages(messages);

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
          system: translated.system,
          messages: translated.messages,
          tools: toolsAsAnthropicSchema(),
          stream: true,
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw await claudeFailureFromResponse(response);
      if (!response.body) throw new AiFailure('vazio');

      return await collectClaudeStream(response.body, timeout.signal, onText);
    } catch (error) {
      if (request.signal?.aborted) return { text: '', toolCalls: [] };

      if (error instanceof AiFailure) throw error;
      throw new AiFailure(timeout.signal.aborted ? 'demora' : 'rede');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Traduz as mensagens genéricas que `ai-service.ts` já usa para qualquer
 * provedor (estilo OpenAI: `role: 'system'/'tool'`, `tool_calls`,
 * `tool_call_id`) para o formato de blocos da Anthropic.
 *
 * Duas diferenças sem equivalente direto: o `system` é um campo à parte, não
 * uma mensagem — por isso sai à parte, não vai na lista; e um pedido de
 * ferramenta e a sua resposta vivem dentro de UMA mensagem `assistant`/`user`
 * como blocos, nunca em mensagens `tool` próprias — por isso mensagens `tool`
 * consecutivas juntam-se numa única mensagem `user` com um bloco
 * `tool_result` por ferramenta, exatamente como a Anthropic exige (todas as
 * respostas de um turno de ferramentas têm de chegar juntas).
 */
function toAnthropicMessages(
  raw: readonly unknown[],
): { readonly system: string; readonly messages: readonly AnthropicMessage[] } {
  let system = '';
  const messages: AnthropicMessage[] = [];

  for (const entry of raw) {
    const message = entry as GenericMessage;

    if (message.role === 'system') {
      if (typeof message.content === 'string') system = message.content;
      continue;
    }

    if (message.role === 'tool') {
      const block: AnthropicContentBlock = {
        type: 'tool_result',
        tool_use_id: message.tool_call_id ?? '',
        content: typeof message.content === 'string' ? message.content : '',
      };

      const last = messages.at(-1);

      if (last?.role === 'user' && isBlockList(last.content)) {
        const blocks: AnthropicContentBlock[] = [...last.content, block];
        messages[messages.length - 1] = { role: 'user', content: blocks };
      } else {
        messages.push({ role: 'user', content: [block] });
      }
      continue;
    }

    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const text = typeof message.content === 'string' ? message.content : '';

      messages.push({
        role: 'assistant',
        content: [
          ...(text.trim().length > 0 ? [{ type: 'text' as const, text }] : []),
          ...message.tool_calls.map((call) => ({
            type: 'tool_use' as const,
            id: call.id,
            name: call.function.name,
            input: parseToolArgs(call.function.arguments),
          })),
        ],
      });
      continue;
    }

    if (message.role === 'user' || message.role === 'assistant') {
      messages.push({
        role: message.role,
        content: typeof message.content === 'string' ? message.content : '',
      });
    }
  }

  return { system, messages };
}

/**
 * `Array.isArray` sozinho não chega a estreitar `string | readonly T[]` de
 * forma limpa aqui — este predicado explícito é o que faz o TypeScript (e o
 * ESLint, que compila com regras mais estritas) confiar no tipo depois.
 */
function isBlockList(
  content: string | readonly AnthropicContentBlock[],
): content is readonly AnthropicContentBlock[] {
  return typeof content !== 'string';
}

function parseToolArgs(json: string): Record<string, unknown> {
  try {
    return json.trim().length > 0 ? (JSON.parse(json) as Record<string, unknown>) : {};
  } catch {
    // Argumentos que não são JSON válido: perde-se o pedido, como na DeepSeek.
    return {};
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

/** Uma linha do fluxo de eventos da Anthropic, decodificada, ou `null` se não for uma. */
function parseClaudeEvent(line: string): AnthropicStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;

  const payload = trimmed.slice(5).trim();
  if (payload.length === 0) return null;

  try {
    return JSON.parse(payload) as AnthropicStreamEvent;
  } catch {
    return null;
  }
}

/** Uma linha do fluxo de eventos da Anthropic, ou `null` se não trouxer texto. */
export function parseClaudeEventLine(line: string): string | null {
  const event = parseClaudeEvent(line);
  if (event?.type !== 'content_block_delta') return null;
  if (event.delta?.type !== 'text_delta') return null;

  return event.delta.text ?? null;
}

/**
 * Lê o fluxo inteiro separando texto de pedidos de ferramenta — a versão com
 * ferramentas de `readClaudeStream`, usada por `run()`.
 *
 * Um `tool_use` chega em três tempos: `content_block_start` traz o `id` e o
 * `name` do bloco; um ou mais `content_block_delta` do tipo `input_json_delta`
 * trazem o JSON dos argumentos aos bocados (`partial_json`), só interpretável
 * depois de completo — por isso acumula-se por índice em vez de se tentar
 * interpretar a cada pedaço, a mesma disciplina do `collect` da DeepSeek.
 */
export async function collectClaudeStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onText: (chunk: string) => void,
): Promise<StreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let text = '';
  const blocks = new Map<number, { type: string; id: string; name: string; json: string }>();

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const event = parseClaudeEvent(line);
        if (!event || event.index === undefined) continue;

        if (event.type === 'content_block_start' && event.content_block) {
          blocks.set(event.index, {
            type: event.content_block.type,
            id: event.content_block.id ?? '',
            name: event.content_block.name ?? '',
            json: '',
          });
          continue;
        }

        if (event.type !== 'content_block_delta' || !event.delta) continue;

        if (event.delta.type === 'text_delta' && event.delta.text) {
          text += event.delta.text;
          onText(event.delta.text);
        }

        if (event.delta.type === 'input_json_delta' && event.delta.partial_json !== undefined) {
          const block = blocks.get(event.index);
          if (block) block.json += event.delta.partial_json;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const toolCalls: ToolCall[] = [];
  for (const block of blocks.values()) {
    if (block.type !== 'tool_use' || block.name.length === 0) continue;

    try {
      toolCalls.push({
        id: block.id.length > 0 ? block.id : block.name,
        name: block.name,
        args: block.json.trim().length > 0 ? (JSON.parse(block.json) as Record<string, unknown>) : {},
      });
    } catch {
      // Argumentos que não fecharam em JSON válido: o pedido perde-se, como
      // na DeepSeek — é melhor do que correr uma ferramenta a meio.
    }
  }

  return { text, toolCalls };
}
