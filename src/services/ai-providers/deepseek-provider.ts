import type { AiProvider, AiRequest, AssistantContext, AssistantMemory } from '@/types/assistant';
import { AI_PROVIDERS, type DeepSeekModelId } from '@/types/ai-provider-settings';
import { describeContext } from '../assistant/context';
import { MEMORY_LABELS } from '../assistant/memory-service';

/**
 * DeepSeek (Parte 12 §Provedores).
 *
 * Cumpre o mesmo contrato que o `RuleProvider`: streaming pedaço a pedaço,
 * cancelável por `AbortSignal`. Nenhum componente muda ao trocar de um para o
 * outro, porque nenhum componente conhece o provedor — foi para isto que o
 * `AiProvider` foi desenhado na Parte 1.
 *
 * A API é compatível com a da OpenAI: `chat/completions` com `stream: true` e
 * eventos `text/event-stream`. Quem quiser ligar a OpenAI, o Groq ou um Ollama
 * local copia esta classe e troca o endereço.
 *
 * **O que sai daqui:** o que se escreve no assistente, o histórico da conversa
 * ativa, e um resumo do contexto do sistema. Vai para os servidores da
 * DeepSeek. A janela de configuração di-lo antes de se ligar seja o que for.
 */

/** Quantas mensagens do histórico acompanham o pedido. */
const HISTORY_LIMIT = 12;

/** Quanto tempo se espera antes de desistir. */
const TIMEOUT_MS = 60_000;

interface StreamChunk {
  readonly choices?: readonly {
    readonly delta?: { readonly content?: string; readonly reasoning_content?: string };
  }[];
}

export class DeepSeekProvider implements AiProvider {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek';

  constructor(
    private apiKey: string,
    private model: DeepSeekModelId = 'deepseek-chat',
    /** Injetável para os testes correrem sem rede. */
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  setKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setModel(model: DeepSeekModelId): void {
    this.model = model;
  }

  async *stream(request: AiRequest): AsyncIterable<string> {
    if (!this.isConfigured()) {
      yield 'Falta a chave da API. Abra a Personalização e cole-a em Assistente.';
      return;
    }

    // Um pedido sem limite de tempo fica pendurado para sempre numa rede má, e
    // o núcleo ficava a "analisar" sem nunca responder.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);

    // O cancelamento de quem chama e o do relógio têm de valer os dois.
    const onAbort = (): void => timeout.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchImpl(AI_PROVIDERS.deepseek.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: buildMessages(request),
        }),
        signal: timeout.signal,
      });

      if (!response.ok) {
        yield describeHttpError(response.status);
        return;
      }

      if (!response.body) {
        yield 'O servidor respondeu sem conteúdo.';
        return;
      }

      yield* readStream(response.body, timeout.signal);
    } catch (error) {
      // Cancelar não é falhar: quem cancelou já sabe que cancelou.
      if (request.signal?.aborted) return;

      yield timeout.signal.aborted
        ? 'O pedido demorou demasiado e foi cancelado.'
        : 'Não consegui chegar à DeepSeek. Verifique a ligação à rede.';
      void error;
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Lê o corpo da resposta e devolve o texto à medida que chega.
 *
 * Exportada porque é onde está a lógica que vale a pena testar, e testá-la não
 * deve exigir um servidor.
 */
export async function* readStream(
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

      // Um evento pode chegar partido a meio entre dois pedaços da rede. Só se
      // processa até à última linha completa; o resto fica para a próxima.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const text = parseEventLine(line);
        if (text !== null) yield text;
      }
    }
  } finally {
    // Sem isto, cancelar a meio deixava a ligação aberta.
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Uma linha do fluxo de eventos, ou `null` se não trouxer texto.
 *
 * Pura, e é a peça mais fácil de partir: o formato tem linhas vazias, um
 * `[DONE]` final, e pedaços sem conteúdo nenhum.
 */
export function parseEventLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;

  const payload = trimmed.slice(5).trim();
  if (payload.length === 0 || payload === '[DONE]') return null;

  try {
    const chunk = JSON.parse(payload) as StreamChunk;
    const delta = chunk.choices?.[0]?.delta;

    // O `reasoner` manda o raciocínio à parte. Não se mostra: é ruído para
    // quem só quer a resposta, e a spec pede uma IA objetiva.
    return delta?.content ?? null;
  } catch {
    // Uma linha malformada não pode partir a resposta inteira.
    return null;
  }
}

/** As mensagens enviadas, com o contexto do sistema à cabeça. */
export function buildMessages(
  request: AiRequest,
): readonly { readonly role: 'system' | 'user' | 'assistant'; readonly content: string }[] {
  const history = request.history
    // A mensagem vazia que está a ser escrita ainda não é uma mensagem.
    .filter((message) => message.text.trim().length > 0)
    .slice(-HISTORY_LIMIT)
    .map((message) => ({
      role: message.author === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: message.text,
    }));

  return [
    { role: 'system', content: systemPrompt(request.context, request.memory) },
    ...history,
    { role: 'user', content: request.prompt },
  ];
}

/**
 * A personalidade e o contexto (Parte 7.1 §Personalidade).
 *
 * "Elegante, objetiva, sem emojis" está na especificação, e é aqui que se diz
 * ao modelo. O contexto vai junto para ele poder responder ao presente em vez
 * de perguntar as horas de volta.
 */
export function systemPrompt(
  context: AssistantContext | null,
  memory: AssistantMemory,
): string {
  const lines = [
    'És o JARVIS, o assistente de um sistema operativo de IA.',
    'Respondes em português de Portugal, com frases curtas e diretas.',
    'Nunca usas emojis. Nunca inventas factos sobre o sistema que não constem do contexto abaixo.',
    'Se não souberes, dizes que não sabes.',
  ];

  if (context) {
    lines.push('', `Contexto de agora: ${describeContext(context)}`);
    lines.push(`Tema em vigor: ${context.theme}. Estado do sistema: ${context.systemState}.`);
  }

  const preferences = Object.entries(memory.preferences);
  if (preferences.length > 0) {
    lines.push(
      '',
      `O que sabes de quem te usa: ${preferences
        .map(([key, value]) => `${(MEMORY_LABELS[key] ?? key).toLowerCase()} ${value}`)
        .join('; ')}.`,
    );
  }

  return lines.join('\n');
}

/** Diz o que correu mal em vez de mostrar um número. */
export function describeHttpError(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return 'A chave não foi aceite. Verifique-a na Personalização.';
    case 402:
      return 'A conta da DeepSeek não tem saldo.';
    case 429:
      return 'Demasiados pedidos seguidos. Espere um pouco e tente de novo.';
    case 500:
    case 502:
    case 503:
      return 'A DeepSeek está com problemas. Não é do seu lado.';
    default:
      return `A DeepSeek recusou o pedido (código ${status}).`;
  }
}
