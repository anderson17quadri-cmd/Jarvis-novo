import { create } from 'zustand';

import { newsService } from '@/services/news/news-service';
import { notificationService } from '@/services/notification-service';
import type { NewsFeed } from '@/types/news';

interface NewsState {
  /** Último feed de notícias. `null` até à primeira leitura. */
  readonly snapshot: NewsFeed | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
  /** A última leitura falhou — `null` quando correu bem. */
  readonly error: string | null;
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
  error: null,

  refresh: async () => {
    const snapshot = await newsService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    if (get().snapshot === null && newsService.current !== null) {
      set({ snapshot: newsService.current, isLoading: false });
    }

    const unsubData = newsService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
    const unsubError = newsService.subscribeError((error) => {
      set(error !== null ? { error, isLoading: false } : { error });
    });

    return () => {
      unsubData();
      unsubError();
    };
  },

  markRead: async (articleId, isRead = true) => {
    try {
      await newsService.markRead(articleId, isRead);
      const snapshot = newsService.current;
      if (snapshot) set({ snapshot });
    } catch {
      notificationService.error('Não consegui marcar a notícia', 'Tenta outra vez daqui a pouco.');
    }
  },

  toggleFavorite: async (articleId) => {
    try {
      await newsService.toggleFavorite(articleId);
      const snapshot = newsService.current;
      if (snapshot) set({ snapshot });
    } catch {
      notificationService.error('Não consegui guardar o favorito', 'Tenta outra vez daqui a pouco.');
    }
  },
}));
