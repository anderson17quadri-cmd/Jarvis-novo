/**
 * Escolha do provedor de pesquisa web (Peça 18).
 *
 * A Brave Search precisa de chave — por isso o padrão é o da IA e das notícias:
 * a chave vai para o cofre do sistema, nunca para o storage normal. A presença
 * da chave é a própria configuração: sem chave, mantém-se o simulado; com
 * chave, passa a real. Não há interruptor separado.
 */

export interface WebSearchSettings {
  /** Chave da Brave Search — vive no cofre, não no storage (ver a store). */
  readonly apiKey: string;
}

export const DEFAULT_WEB_SEARCH_SETTINGS: WebSearchSettings = {
  apiKey: '',
};

/**
 * Uma chave da Brave Search é uma sequência alfanumérica longa. Isto é só um
 * engano-óbvio: não valida que a chave *funciona*, só que não se colou outra
 * coisa qualquer.
 */
export function looksLikeBraveSearchKey(value: string): boolean {
  return /^[A-Za-z0-9]{20,}$/.test(value.trim());
}

/**
 * Esconde a chave para a poder mostrar sem a revelar — `abcd12…89ef`, o
 * suficiente para saber qual é, sem a expor.
 */
export function maskWebSearchKey(value: string): string {
  const key = value.trim();
  if (key.length <= 14) return '•'.repeat(Math.max(key.length, 8));
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
