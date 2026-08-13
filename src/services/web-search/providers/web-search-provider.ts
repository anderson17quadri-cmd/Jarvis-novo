import type { SearchOutcome, SearchResult } from '@/types/web-search';

/**
 * Contrato de um provedor de pesquisa web.
 *
 * Ao contrário dos serviços com sondagem (notícias, meteorologia), a pesquisa
 * é por pedido: cada chamada à ferramenta do assistente é uma ida à rede. O
 * provedor só devolve título, resumo e endereço de cada resultado — o contrato
 * não tem como devolver mais nada, de propósito.
 */
export interface WebSearchProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  search(query: string, signal?: AbortSignal): Promise<SearchOutcome>;
}

/**
 * Resultados simulados, claramente inventados. A `url` aponta para um domínio
 * de exemplo que não existe, e o texto é genérico — nunca se faz passar por uma
 * pesquisa a sério. Serve para a ferramenta responder na mesma quando não há
 * chave configurada, sem rebentar e sem mentir sobre o que procurou.
 */
const SEED: readonly SearchResult[] = [
  {
    title: 'Exemplo de resultado — pesquisa simulada',
    snippet: 'Isto é um resultado de demonstração. Para pesquisas reais, configure uma chave em Personalização → Pesquisa web.',
    url: 'https://exemplo.pt/pesquisa-simulada',
  },
  {
    title: 'Segundo resultado de exemplo',
    snippet: 'Também simulado: nenhum destes endereços leva a uma página real.',
    url: 'https://exemplo.pt/segundo-resultado',
  },
  {
    title: 'Terceiro resultado de exemplo',
    snippet: 'A pesquisa web real fica a um passo de distância: basta guardar uma chave.',
    url: 'https://exemplo.pt/terceiro-resultado',
  },
];

export class MockWebSearchProvider implements WebSearchProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  isConfigured(): boolean {
    return true;
  }

  async search(): Promise<SearchOutcome> {
    return { isSimulated: true, results: SEED };
  }
}
