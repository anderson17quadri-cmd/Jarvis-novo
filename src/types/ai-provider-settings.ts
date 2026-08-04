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

export type AiProviderId = 'regras' | 'deepseek';

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
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  // O local por omissão: um sistema que começa a enviar o que se escreve para
  // fora sem ninguém o ter pedido é um sistema que trai quem o usa.
  provider: 'regras',
  apiKey: '',
  model: 'deepseek-chat',
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
