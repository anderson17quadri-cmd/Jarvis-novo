/**
 * Escolha do provedor de pesquisa web (Peça 18; SearXNG no item 28, 20/08/2026).
 *
 * Três provedores, escolha explícita — ao contrário do padrão antigo (a
 * presença da chave da Brave decidia sozinha), duas opções sem chave
 * nenhuma (Simulado e SearXNG) tornam essa implicitude ambígua: um endereço
 * de SearXNG por omissão sempre presente não dizia se a pessoa queria
 * mesmo usá-lo. `provider` é a fonte da verdade agora; a chave e o
 * endereço só interessam quando o provedor correspondente está escolhido.
 */

export type WebSearchProviderChoice = 'mock' | 'searxng' | 'brave';

export const DEFAULT_SEARXNG_BASE_URL = 'http://localhost:8888';

export interface WebSearchSettings {
  readonly provider: WebSearchProviderChoice;
  /** Chave da Brave Search — vive no cofre, não no storage (ver a store). */
  readonly apiKey: string;
  /** Endereço da instância local de SearXNG. Só a porta 8888 está na CSP. */
  readonly searxngBaseUrl: string;
}

export const DEFAULT_WEB_SEARCH_SETTINGS: WebSearchSettings = {
  provider: 'mock',
  apiKey: '',
  searxngBaseUrl: DEFAULT_SEARXNG_BASE_URL,
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
