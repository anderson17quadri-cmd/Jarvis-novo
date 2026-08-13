import { MockWebSearchProvider, type WebSearchProvider } from './providers/web-search-provider';
import type { SearchOutcome } from '@/types/web-search';

/**
 * Pesquisa web (Peça 18).
 *
 * Serviço por pedido, não por sondagem — a pesquisa acontece quando a
 * ferramenta do assistente a pede, não num intervalo. Tal como nas notícias, a
 * presença da chave é a própria configuração: o hook `useWebSearchSettings`
 * troca o provedor simulado pelo real; sem chave, mantém-se o simulado, que
 * nunca finge que pesquisou a sério.
 */
export class WebSearchService {
  constructor(private provider: WebSearchProvider = new MockWebSearchProvider()) {}

  get providerName(): string {
    return this.provider.name;
  }

  setProvider(provider: WebSearchProvider): void {
    this.provider = provider;
  }

  search(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
    return this.provider.search(query, signal);
  }
}

export const webSearchService = new WebSearchService();
