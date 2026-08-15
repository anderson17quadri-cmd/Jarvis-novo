/**
 * Configuração do provedor de IA (Parte 7.1 e Parte 12).
 *
 * A chave fica **no dispositivo e mais nada**. Não vai para o repositório, não
 * passa por servidor nenhum, e o JARVIS não a envia a lado nenhum a não ser ao
 * próprio provedor, no cabeçalho de autorização.
 *
 * Isso não a torna segura: hoje vive no `localStorage`, onde qualquer script
 * da página lhe pode chegar. Um cofre a sério exige o plugin `stronghold` ou o
 * chaveiro do sistema — nativo, e por isso bloqueado. A janela di-lo por
 * escrito, em vez de deixar supor que está guardada com cuidado.
 */

export type AiProviderId = 'regras' | 'deepseek' | 'claude' | 'ollama';

/**
 * O modelo que interpreta o ecrã (Fase 3.5).
 *
 * É uma escolha à parte do provedor de texto porque é uma decisão de
 * privacidade diferente: o que se escreve ao assistente já sai (DeepSeek/
 * Claude), mas um print do ecrã é outra categoria de dado — pode mostrar
 * senhas, contas, mensagens. Por isso a omissão é o **local** (Ollama), onde
 * o print nunca sai da máquina, e o remoto (Claude) é opt-in explícito.
 */
export type VisionProviderId = 'ollama' | 'claude';

/** Os provedores que entram na cadeia de reserva — o local (`regras`) é o abrigo final, não um degrau da cadeia. */
export type ChainProviderId = Exclude<AiProviderId, 'regras'>;

/**
 * Ordem por omissão da cadeia de reserva (Parte 12 §Orquestrador multi-provedor).
 *
 * Só o DeepSeek por omissão (14/08/2026): a cadeia com Claude e Ollama fazia
 * o sistema saltar entre provedores sem ninguém ter pedido. O Ollama continua
 * aqui no catálogo — é para onde entra o Llama, mais tarde — mas só entra na
 * cadeia se for acrescentado à mão em Personalização → Assistente. É uma
 * preferência guardada, não uma constante fixa.
 */
export const DEFAULT_CHAIN_ORDER: readonly ChainProviderId[] = ['deepseek'];

export interface AiProviderInfo {
  readonly id: AiProviderId;
  readonly name: string;
  readonly description: string;
  /** `false` para o provedor local, que não fala com ninguém. */
  readonly needsKey: boolean;
  /** Onde se obtém a chave. Vazio quando não é preciso nenhuma. */
  readonly keyUrl: string;
  /** Endereço a que se liga. Vazio para o local — é o que prova que não sai daqui. */
  readonly endpoint: string;
}

export const AI_PROVIDERS: Readonly<Record<AiProviderId, AiProviderInfo>> = {
  regras: {
    id: 'regras',
    name: 'Contexto local',
    description:
      'Responde ao que o sistema sabe de si: hora, meteorologia, janelas abertas, notificações e memória. Não fala com ninguém, e não inventa o que não sabe.',
    needsKey: false,
    keyUrl: '',
    endpoint: '',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description:
      'Modelo de linguagem a sério. O que escrever no assistente sai do dispositivo e vai para os servidores da DeepSeek.',
    needsKey: true,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    endpoint: 'https://api.deepseek.com/chat/completions',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    description:
      'Modelo de linguagem da Anthropic. O que escrever no assistente sai do dispositivo e vai para os servidores da Anthropic.',
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description:
      'Um modelo a correr no próprio dispositivo. Nada sai daqui — não há chave, porque não há ninguém do outro lado a cobrar.',
    needsKey: false,
    keyUrl: '',
    endpoint: '',
  },
};

/** As duas opções de visão, com o que as separa: onde o print vai parar. */
export const VISION_PROVIDER_INFO: Readonly<
  Record<VisionProviderId, { readonly name: string; readonly description: string; readonly isRemote: boolean }>
> = {
  ollama: {
    name: 'Ollama (local)',
    description:
      'Um modelo de visão a correr no próprio dispositivo. O print nunca sai da máquina — não há chave, porque não há ninguém do outro lado.',
    isRemote: false,
  },
  claude: {
    name: 'Claude (nuvem)',
    description:
      'O print sai do dispositivo e vai para os servidores da Anthropic. Usa a chave e o modelo do Claude já configurados. Só por escolha explícita.',
    isRemote: true,
  },
};

/** Modelos da DeepSeek, com o que cada um serve. */
export const DEEPSEEK_MODELS = [
  {
    id: 'deepseek-chat',
    name: 'Chat',
    description: 'Rápido e barato. Chega para conversa e comandos.',
  },
  {
    id: 'deepseek-reasoner',
    name: 'Reasoner',
    description: 'Pensa antes de responder. Mais lento e mais caro.',
  },
] as const;

export type DeepSeekModelId = (typeof DEEPSEEK_MODELS)[number]['id'];

export interface AiSettings {
  readonly provider: AiProviderId;
  readonly apiKey: string;
  readonly model: DeepSeekModelId;
  /**
   * Deixar o sistema escolher o modelo por pedido (Parte 12).
   *
   * Desligado por omissão: quem escolheu um modelo escolheu-o, e passar por
   * cima disso sem avisar era o sistema a gastar dinheiro por conta própria.
   * A janela explica a regra antes de se ligar.
   */
  readonly autoModel: boolean;
  /** Chave da Anthropic. Mesmas regras da `apiKey` da DeepSeek. */
  readonly claudeApiKey: string;
  readonly claudeModel: 'claude-sonnet-5' | 'claude-opus-5';
  /** Nome do modelo instalado localmente — depende do que foi feito `ollama pull`. */
  readonly ollamaModel: string;
  /** Endereço do Ollama. Configurável porque a porta pode ter sido mudada. */
  readonly ollamaBaseUrl: string;
  /** Ordem de reserva da cadeia — a preferência guardada, não uma constante fixa. */
  readonly providerOrder: readonly ChainProviderId[];
  /** Quem interpreta o ecrã (Fase 3.5). Local por omissão: o print não sai daqui. */
  readonly visionProvider: VisionProviderId;
  /** Modelo de visão instalado localmente — ex.: `llava`, `qwen2.5-vl`. Depende do `ollama pull`. */
  readonly ollamaVisionModel: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  // O local por omissão: um sistema que começa a enviar o que se escreve para
  // fora sem ninguém o ter pedido é um sistema que trai quem o usa.
  provider: 'regras',
  apiKey: '',
  model: 'deepseek-chat',
  autoModel: false,
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-5',
  ollamaModel: '',
  ollamaBaseUrl: 'http://localhost:11434',
  providerOrder: DEFAULT_CHAIN_ORDER,
  visionProvider: 'ollama',
  ollamaVisionModel: '',
};

/**
 * Uma chave da DeepSeek começa por `sk-`.
 *
 * Não valida que a chave *funciona* — isso só o servidor sabe. Serve para
 * apanhar o engano óbvio de colar outra coisa qualquer, antes de gastar um
 * pedido a descobri-lo.
 */
export function looksLikeApiKey(value: string): boolean {
  return /^sk-[A-Za-z0-9._-]{8,}$/.test(value.trim());
}

/**
 * Esconde a chave para a poder mostrar sem a revelar.
 * `sk-abc…wxyz` — o suficiente para saber qual é, sem a expor a quem olhar.
 */
export function maskApiKey(value: string): string {
  const key = value.trim();
  if (key.length <= 11) return '•'.repeat(Math.max(key.length, 8));

  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
