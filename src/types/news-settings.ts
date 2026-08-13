/**
 * Escolha do provedor de notícias (Peça 8, lote 2).
 *
 * Ao contrário da meteorologia, a NewsAPI **precisa de chave** — por isso o
 * padrão é o da IA: a chave vai para o cofre do sistema, nunca para o storage
 * normal. A presença da chave é a própria configuração: sem chave, mantém-se o
 * simulado; com chave, passa a real. Não há interruptor separado, tal como na
 * DeepSeek.
 */

export interface NewsSettings {
  /** Chave da NewsAPI — vive no cofre, não no storage (ver `useNewsSettingsStore`). */
  readonly apiKey: string;
  /** Código ISO 3166-1 alfa-2 do país do topo de notícias (ex.: `pt`). */
  readonly country: string;
}

export const DEFAULT_NEWS_SETTINGS: NewsSettings = {
  apiKey: '',
  country: 'pt',
};

/**
 * Uma chave da NewsAPI é uma sequência alfanumérica longa (normalmente 32
 * caracteres hexadecimais). Isto é só um engano-óbvio: não valida que a chave
 * *funciona*, só que não se colou outra coisa qualquer.
 */
export function looksLikeNewsApiKey(value: string): boolean {
  return /^[A-Za-z0-9]{20,}$/.test(value.trim());
}

/**
 * Esconde a chave para a poder mostrar sem a revelar — `abcd12…89ef`, o
 * suficiente para saber qual é, sem a expor.
 */
export function maskNewsApiKey(value: string): string {
  const key = value.trim();
  if (key.length <= 14) return '•'.repeat(Math.max(key.length, 8));
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
