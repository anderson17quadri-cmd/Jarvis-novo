import { PollingDataService } from '../data-service';
import { MockNewsProvider, type NewsProvider } from './providers/news-provider';
import type { NewsCategory, NewsFeed } from '@/types/news';

/** As notícias renovam-se de quinze em quinze minutos. */
const NEWS_INTERVAL_MS = 15 * 60_000;

export class NewsService extends PollingDataService<NewsFeed> {
  constructor(private provider: NewsProvider = new MockNewsProvider()) {
    super({ intervalMs: NEWS_INTERVAL_MS });
  }

  get providerName(): string {
    return this.provider.name;
  }

  get isSimulated(): boolean {
    return this.current?.isSimulated ?? true;
  }

  setProvider(provider: NewsProvider): void {
    this.provider = provider;
    void this.refresh();
  }

  /** Filtra a lista em memória, sem novo pedido ao provedor. */
  byCategory(category: NewsCategory | 'todas'): NewsFeed['articles'] {
    const articles = this.current?.articles ?? [];
    return category === 'todas'
      ? articles
      : articles.filter((article) => article.category === category);
  }

  async markRead(articleId: string, isRead = true): Promise<void> {
    await this.provider.markRead(articleId, isRead);
    await this.refresh();
  }

  async toggleFavorite(articleId: string): Promise<void> {
    await this.provider.toggleFavorite(articleId);
    await this.refresh();
  }

  protected async fetch(): Promise<NewsFeed | null> {
    if (!this.provider.isConfigured()) return null;
    return this.provider.fetch();
  }
}

export const newsService = new NewsService();
