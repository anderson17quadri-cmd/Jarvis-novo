/** Notícias (Parte 6.2 §Widgets previstos). */

export type NewsCategory = 'tecnologia' | 'negocios' | 'ciencia' | 'mundo' | 'desporto';

export interface NewsArticle {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly category: NewsCategory;
  /** Milissegundos desde a época Unix. */
  readonly publishedAt: number;
  /**
   * Endereço do artigo. Aberto pelo `PlatformAdapter.openExternal`, que só
   * aceita `https:` — um provedor que devolva outro esquema é recusado.
   */
  readonly url: string;
  readonly isRead: boolean;
  readonly isFavorite: boolean;
}

export interface NewsFeed {
  readonly articles: readonly NewsArticle[];
  readonly fetchedAt: number;
  readonly isSimulated: boolean;
}

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  tecnologia: 'Tecnologia',
  negocios: 'Negócios',
  ciencia: 'Ciência',
  mundo: 'Mundo',
  desporto: 'Desporto',
};
