import { create } from 'zustand';

import type { Command } from '@/components/command-palette/command-registry';
import { searchService, type SearchInputs } from '@/services/search-service';
import { useCustomThemeStore } from './use-custom-theme-store';
import { useMailStore } from './use-mail-store';
import { useNewsStore } from './use-news-store';
import { useNotificationStore } from './use-notification-store';
import { useWorkspaceStore } from './use-workspace-store';

/**
 * Estado da pesquisa global (Parte 8).
 *
 * A paleta de comandos lê daqui a pesquisa e os resultados; quem reúne o
 * conteúdo é a store, que subscreve as fontes e recalcula sempre que alguma
 * muda. O `searchService` continua sem conhecer store nenhuma.
 */

interface SearchState {
  readonly query: string;
  readonly results: readonly Command[];

  setQuery: (query: string) => void;
  /**
   * Liga a store às fontes de conteúdo. Devolve a função de cancelamento —
   * hidrata também o email e as notícias, que só têm dados enquanto alguém
   * subscreve.
   */
  hydrate: () => () => void;
}

function readInputs(): SearchInputs {
  return {
    content: {
      mail: useMailStore.getState().snapshot?.messages ?? [],
      news: useNewsStore.getState().snapshot?.articles ?? [],
      notifications: useNotificationStore.getState().notifications,
    },
    layouts: useWorkspaceStore.getState().layouts,
    customThemes: useCustomThemeStore.getState().themes,
  };
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: searchService.search('', readInputs()),

  setQuery: (query) => {
    set({ query, results: searchService.search(query, readInputs()) });
  },

  hydrate: () => {
    const unsubMail = useMailStore.getState().hydrate();
    const unsubNews = useNewsStore.getState().hydrate();

    const recompute = (): void => {
      set({ results: searchService.search(get().query, readInputs()) });
    };

    const unsubSources = [
      useMailStore.subscribe(recompute),
      useNewsStore.subscribe(recompute),
      useNotificationStore.subscribe(recompute),
      useWorkspaceStore.subscribe(recompute),
      useCustomThemeStore.subscribe(recompute),
    ];

    recompute();

    return () => {
      unsubMail();
      unsubNews();
      for (const unsubscribe of unsubSources) unsubscribe();
    };
  },
}));
