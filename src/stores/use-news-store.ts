import { create } from 'zustand';

import { newsService } from '@/services/news/news-service';
import type { NewsFeed } from '@/types/news';

interface NewsState {
  /** Último feed de notícias. `null` até à primeira leitura. */
  readonly snapshot: NewsFeed | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
  /** Força uma leitura avulsa. */
  readonly refresh: () => Promise<void>;
  /**
   * Liga a store ao serviço. Devolve a função de cancelamento — chamá-la
   * desliga a subscrição e pára a sondagem se não houver mais ninguém à
   * escuta.
   */
  readonly hydrate: () => () => void;

  readonly markRead: (articleId: string, isRead?: boolean) => Promise<void>;
  readonly toggleFavorite: (articleId: string) => Promise<void>;
}

export const useNewsStore = create<NewsState>((set, get) => ({
  snapshot: newsService.current,
  isLoading: newsService.current === null,

  refresh: async () => {
    const snapshot = await newsService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    if (get().snapshot === null && newsService.current !== null) {
      set({ snapshot: newsService.current, isLoading: false });
    }

    return newsService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
  },

  markRead: async (articleId, isRead = true) => {
    await newsService.markRead(articleId, isRead);
    const snapshot = newsService.current;
    if (snapshot) set({ snapshot });
  },

  toggleFavorite: async (articleId) => {
    await newsService.toggleFavorite(articleId);
    const snapshot = newsService.current;
    if (snapshot) set({ snapshot });
  },
}));
