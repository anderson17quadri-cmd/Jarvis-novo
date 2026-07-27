/**
 * Estados do núcleo (Parte 8 §Estados). Cada um tem uma aparência própria no
 * `AICore` — cor, rotação, densidade de partículas, radar — e uma etiqueta.
 *
 * `success` é transitório: dispara um pulso e uma explosão de partículas, e
 * regressa a `idle` sozinho. Os outros mantêm-se até alguém os mudar.
 */
export type AssistantMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'success';

/** Quanto tempo o estado de sucesso dura antes de voltar a repouso. */
export const SUCCESS_MODE_DURATION_MS = 1_400;

export type MessageAuthor = 'user' | 'assistant';

export interface AssistantMessage {
  readonly id: string;
  readonly author: MessageAuthor;
  readonly text: string;
  readonly createdAt: number;
  /** `true` enquanto o texto ainda está a ser escrito letra a letra. */
  readonly isStreaming: boolean;
}

/** Um pedido ao provedor de IA. */
export interface AiRequest {
  readonly prompt: string;
  /** Histórico enviado como contexto. */
  readonly history: readonly AssistantMessage[];
  /** Cancela o pedido a meio. */
  readonly signal?: AbortSignal;
}

/**
 * Contrato de um provedor de IA.
 *
 * O `MockProvider` é o único implementado na Fase 1. Ligar o OpenAI, o Claude ou
 * o Ollama é escrever uma classe que cumpra esta interface e registá-la — nenhum
 * componente muda, porque nenhum componente conhece o provedor.
 */
export interface AiProvider {
  readonly id: string;
  readonly name: string;
  /** `false` quando falta configuração (uma chave de API, por exemplo). */
  isConfigured(): boolean;
  /**
   * Responde em pedaços, para a interface poder escrever à medida que chega.
   * Um provedor sem streaming devolve um único pedaço.
   */
  stream(request: AiRequest): AsyncIterable<string>;
}
