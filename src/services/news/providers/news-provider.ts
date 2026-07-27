import type { NewsArticle, NewsFeed } from '@/types/news';

/**
 * Contrato de um provedor de notícias.
 *
 * `markRead` e `toggleFavorite` fazem parte do contrato porque um provedor real
 * pode querer sincronizar essas marcas com o serviço de origem. O simulado
 * guarda-as em memória.
 */
export interface NewsProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  fetch(signal?: AbortSignal): Promise<NewsFeed | null>;
  markRead(articleId: string, isRead: boolean): Promise<void>;
  toggleFavorite(articleId: string): Promise<void>;
}

/** Artigos de demonstração. Escritos para se perceber que são simulados. */
const SEED: readonly Omit<NewsArticle, 'publishedAt' | 'isRead' | 'isFavorite'>[] = [
  {
    id: 'n1',
    title: 'Novo padrão de interfaces nativas chega aos ambientes de trabalho',
    summary:
      'A adoção de WebViews leves reduz o consumo de memória em aplicações que antes exigiam runtimes completos.',
    source: 'Tech Diário',
    category: 'tecnologia',
    url: 'https://exemplo.pt/interfaces-nativas',
  },
  {
    id: 'n2',
    title: 'Modelos locais aproximam-se do desempenho dos modelos na nuvem',
    summary:
      'Testes independentes mostram diferenças cada vez menores em tarefas de resumo e classificação.',
    source: 'Ciência Hoje',
    category: 'ciencia',
    url: 'https://exemplo.pt/modelos-locais',
  },
  {
    id: 'n3',
    title: 'Investimento em automação de processos cresce no setor dos serviços',
    summary:
      'Pequenas empresas lideram a adoção, com foco em agendamento e triagem de comunicações.',
    source: 'Negócios & Mercados',
    category: 'negocios',
    url: 'https://exemplo.pt/automacao-servicos',
  },
  {
    id: 'n4',
    title: 'Cimeira internacional discute normas para assistentes autónomos',
    summary: 'Delegações procuram um quadro comum para transparência e auditoria de decisões.',
    source: 'Mundo Agora',
    category: 'mundo',
    url: 'https://exemplo.pt/cimeira-assistentes',
  },
  {
    id: 'n5',
    title: 'Análise de dados muda a preparação física nas competições',
    summary: 'Equipas usam telemetria em tempo real para ajustar cargas de treino.',
    source: 'Desporto Total',
    category: 'desporto',
    url: 'https://exemplo.pt/dados-preparacao',
  },
  {
    id: 'n6',
    title: 'Ferramentas de acessibilidade ganham tração em sistemas operativos',
    summary: 'Leitores de ecrã passam a interpretar melhor interfaces desenhadas em canvas.',
    source: 'Tech Diário',
    category: 'tecnologia',
    url: 'https://exemplo.pt/acessibilidade-canvas',
  },
];

export class MockNewsProvider implements NewsProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  /** Marcas de leitura e favoritos, mantidas em memória. */
  private readonly read = new Set<string>();
  private readonly favorites = new Set<string>();

  isConfigured(): boolean {
    return true;
  }

  async fetch(): Promise<NewsFeed> {
    const now = Date.now();

    return {
      articles: SEED.map((article, index) => ({
        ...article,
        // Espalhadas pelas últimas horas, da mais recente para a mais antiga.
        publishedAt: now - (index * 47 + 12) * 60_000,
        isRead: this.read.has(article.id),
        isFavorite: this.favorites.has(article.id),
      })),
      fetchedAt: now,
      isSimulated: true,
    };
  }

  async markRead(articleId: string, isRead: boolean): Promise<void> {
    if (isRead) this.read.add(articleId);
    else this.read.delete(articleId);
  }

  async toggleFavorite(articleId: string): Promise<void> {
    if (this.favorites.has(articleId)) this.favorites.delete(articleId);
    else this.favorites.add(articleId);
  }
}
