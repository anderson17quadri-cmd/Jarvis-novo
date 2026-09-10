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
  /** Marcada como favorita (Parte 7.1 §Histórico). Sobrevive à sessão. */
  readonly isFavourite: boolean;
  /**
   * Que modelo respondeu, e porquê — "Reasoner · a pergunta pede raciocínio".
   *
   * Só existe quando houve escolha a registar. Uma resposta do provedor local
   * não tem modelo nenhum a declarar, e inventar-lhe um rótulo era ruído.
   */
  readonly model?: string;
}

/**
 * Uma conversa (Parte 7.1 §Histórico de conversas).
 *
 * O histórico não é uma lista infinita de mensagens: são conversas, cada uma
 * com o seu título, que se podem fixar, exportar e apagar à parte.
 */
export interface AssistantConversation {
  readonly id: string;
  /** Tirado da primeira coisa que se escreveu. Não se inventa um título. */
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Fixada no topo da lista, imune ao limite de histórico. */
  readonly isPinned: boolean;
  readonly messages: readonly AssistantMessage[];
}

/** Quantas conversas não fixadas se guardam. As fixadas não contam. */
export const CONVERSATION_LIMIT = 40;

/** Quantas mensagens no máximo em cada conversa. A partir daqui, as mais antigas caem. */
export const MSG_LIMIT = 200;

/** Título de uma conversa ainda sem nada escrito. */
export const UNTITLED_CONVERSATION = 'Nova conversa';

/** Comprimento máximo de um título tirado da primeira mensagem. */
export const TITLE_MAX_LENGTH = 42;

/**
 * O presente, tal como o assistente o conhece (Parte 7.2 §Contexto).
 *
 * É montado fora dos serviços e injetado, pela mesma razão que o executor das
 * automações: senão o `AIService` acabava a importar seis stores e a meteorologia.
 */
export interface AssistantContext {
  readonly now: Date;
  /** Nome de quem está a usar, se a sessão o souber. */
  readonly userName: string | null;
  /** `null` quando o provedor de meteorologia não respondeu. */
  readonly weather: { readonly location: string; readonly temperatureC: number; readonly label: string } | null;
  /** Títulos das janelas abertas, pela ordem em que estão. */
  readonly openWindows: readonly string[];
  readonly unreadNotifications: number;
  /** Já é o nome a mostrar ("Foco", "Apresentação"), não o identificador. */
  readonly systemState: string;
  /** Já é o nome a mostrar ("OLED Black"), não o identificador ("oled"). */
  readonly theme: string;
}

/** Um pedido ao provedor de IA. */
export interface AiRequest {
  readonly prompt: string;
  /** Histórico enviado como contexto. */
  readonly history: readonly AssistantMessage[];
  /** O presente. `null` quando ninguém registou uma fonte de contexto. */
  readonly context: AssistantContext | null;
  /** O que ficou de conversas anteriores — preferências e últimos pedidos. */
  readonly memory: AssistantMemory;
  /** Cancela o pedido a meio. */
  readonly signal?: AbortSignal;
}

/**
 * Memória local (Parte 7.2 §Memória).
 *
 * Fica no dispositivo e mais nada: não há para onde a enviar, e não haveria
 * mesmo que houvesse rede — é isto que o assistente sabe de quem o usa.
 */
export interface AssistantMemory {
  /** Preferências ditas em voz alta: "trata-me por…", "moro em…". */
  readonly preferences: Readonly<Record<string, string>>;
  /** Últimos pedidos, do mais recente para o mais antigo, sem repetições. */
  readonly recentPrompts: readonly string[];
}

/** Quantos pedidos a memória guarda. */
export const MEMORY_PROMPT_LIMIT = 20;

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
  /**
   * `true` quando responder implica mandar o pedido para fora da máquina —
   * a DeepSeek, o Claude. `false` para o `RuleProvider` (nunca fala com
   * ninguém) e para o Ollama (corre no próprio dispositivo, ver
   * Parte 7.2 §AI Orchestrator). É o que a permissão de rede do plugin
   * "Assistente JARVIS" (Parte 14 §Permissões por plugin) condiciona de
   * verdade — ver `ai-service.ts`.
   */
  readonly isRemote: boolean;
  /** `false` quando falta configuração (uma chave de API, por exemplo). */
  isConfigured(): boolean;
  /**
   * Responde em pedaços, para a interface poder escrever à medida que chega.
   * Um provedor sem streaming devolve um único pedaço.
   */
  stream(request: AiRequest): AsyncIterable<string>;
}
