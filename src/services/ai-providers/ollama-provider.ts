import { AiFailure, failureFromStatus } from '@/types/ai-failure';
import type { AiProvider, AiRequest } from '@/types/assistant';
import { toolsAsJsonSchema } from '../assistant/tools';
import { buildMessages, collect, readStream, type StreamResult } from './deepseek-provider';

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
 * **Não sabe de antemão se o modelo que lhe pedires existe.** Isso depende do
 * que foi feito `ollama pull` na máquina — não é algo que o código possa
 * validar sem perguntar ao Ollama primeiro. Mas reconhece a resposta quando
 * ela chega: um modelo em falta vem com um 404 de forma reconhecível
 * (`{"error":{"type":"not_found_error"}}`, ver `ollamaFailure`), distinto de
 * qualquer outro problema do servidor.
 *
 * **Ligado à janela de configurações** (`AiSettings.tsx`, Personalização →
 * Assistente): campo para o modelo (com um botão "Detetar" que pergunta a
 * `GET /api/tags` que modelos já estão instalados, em vez de se escrever
 * o nome às cegas), o endereço base editável, e entra na cadeia de
 * fallback automática (`use-ai-settings-store.ts`, `providerOrder`). A
 * ordem já não é fixa — reordena-se em Personalização → Assistente.
 * Confirmado a sério com um Ollama real a correr no PC, não só com
 * testes que simulam a resposta.
 */

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Quanto se espera pelo Ollama antes de desistir e cair para o provedor
 * seguinte (DeepSeek, na cadeia típica). Reduzido de 60 s (14/08/2026): o
 * Ollama é local, por isso uma falha de rede — o caso mais comum — é imediata
 * (`fetch` recusa a ligação). Quem chega aqui é o Ollama *a correr mas preso*
 * (modelo a carregar, ou a geração encravada), e nesse caso ficar 60 s calado
 * antes de o fallback responder era o sintoma de "o Ollama não está a
 * funcionar e a app não diz nada". 20 s dá-lhe uma hipótese justa sem fazer o
 * utilizador esperar demasiado por uma resposta que já não vem dali.
 */
const TIMEOUT_MS = 20_000;

/**
 * Distingue "modelo não instalado" do genérico de servidor. Confirmado ao
 * vivo (13/08/2026) contra um Ollama real: um 404 por modelo em falta vem
 * com `{"error":{"type":"not_found_error",...}}` — outros 404 (endereço
 * errado, por exemplo) não têm essa forma, e caem no genérico à mesma.
 */
async function ollamaFailure(response: Response): Promise<AiFailure> {
  if (response.status === 404) {
    try {
      const body = (await response.json()) as { error?: { type?: string } };
      if (body.error?.type === 'not_found_error') return new AiFailure('modelo');
    } catch {
      // Corpo sem JSON válido — cai no genérico abaixo.
    }
  }
  return failureFromStatus(response.status);
}

/**
 * Famílias de modelos que a Ollama documenta como capazes de pedir
 * ferramentas (`tools` no `/v1/chat/completions`).
 *
 * Não há forma de perguntar isto ao próprio Ollama sem fazer um pedido a
 * sério — e um pedido de sondagem antes de cada pedido real custa tempo por
 * nada. Em vez disso, compara-se o nome do modelo com prefixos conhecidos.
 * Esta lista fica desatualizada à medida que a Ollama for suportando mais
 * modelos — é uma lista de hoje, não uma verdade permanente. Confirmado a
 * sério (13/08/2026): `qwen3:8b` cumpre o formato de pedido de ferramentas
 * da OpenAI e devolve `tool_calls` na resposta.
 */
const TOOL_CAPABLE_PREFIXES: readonly string[] = [
  'qwen',
  'llama3.1',
  'llama3.2',
  'llama3.3',
  'mistral',
  'mixtral',
  'firefunction',
  'command-r',
];

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  readonly isRemote = false;

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

  /**
   * `true` se o modelo configurado for de uma família conhecida por saber
   * pedir ferramentas. Ver `TOOL_CAPABLE_PREFIXES` — é um palpite informado,
   * não uma garantia: um modelo customizado ou uma versão futura pode
   * suportar sem aparecer aqui, ou o inverso.
   */
  supportsToolCalling(): boolean {
    const name = this.model.trim().toLowerCase();
    return TOOL_CAPABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
  }

  /**
   * Uma passagem completa, com ferramentas — mesmo contrato de
   * `DeepSeekProvider.run`, reaproveitando `collect` para não duplicar o
   * parser do formato de streaming (os dois falam o mesmo protocolo
   * compatível com a OpenAI).
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
      const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages,
          tools: toolsAsJsonSchema(),
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw await ollamaFailure(response);
      if (!response.body) throw new AiFailure('vazio');

      return await collect(response.body, timeout.signal, onText);
    } catch (error) {
      if (request.signal?.aborted) return { text: '', toolCalls: [] };

      if (error instanceof AiFailure) throw error;
      throw new AiFailure(timeout.signal.aborted ? 'demora' : 'rede');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
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

      if (!response.ok) throw await ollamaFailure(response);
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
