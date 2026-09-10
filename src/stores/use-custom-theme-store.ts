import { create } from 'zustand';

import { createId } from '@/lib/id';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { CUSTOM_THEME_LIMIT, type CustomTheme } from '@/types/custom-theme';

/**
 * Temas personalizados (Parte 15 §Editor de temas).
 *
 * Guarda a lista; quem sabe aplicá-la é o `themeService`, como acontece com os
 * oficiais. A store não escreve uma única variável CSS.
 */

interface CustomThemeState {
  themes: readonly CustomTheme[];

  add: (theme: Omit<CustomTheme, 'id' | 'createdAt'>) => CustomTheme;
  update: (id: string, changes: Partial<Omit<CustomTheme, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  get: (id: string) => CustomTheme | null;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useCustomThemeStore = create<CustomThemeState>((set, get) => ({
  themes: [],

  add: (theme) => {
    const created: CustomTheme = {
      ...theme,
      name: theme.name.trim().length > 0 ? theme.name.trim() : 'Tema sem nome',
      id: `custom:${createId('t')}`,
      createdAt: Date.now(),
    };

    set((state) => ({ themes: [created, ...state.themes].slice(0, CUSTOM_THEME_LIMIT) }));
    logService.audit(`Criar o tema "${created.name}"`, 'executado');
    void get().persist();

    return created;
  },

  update: (id, changes) => {
    set((state) => ({
      themes: state.themes.map((theme) => (theme.id === id ? { ...theme, ...changes } : theme)),
    }));
    void get().persist();
  },

  remove: (id) => {
    set((state) => ({ themes: state.themes.filter((theme) => theme.id !== id) }));
    void get().persist();
  },

  get: (id) => get().themes.find((theme) => theme.id === id) ?? null,

  persist: async () => {
    await storageService.set(STORAGE_KEYS.customThemes, get().themes);
  },

  hydrate: async () => {
    const saved = await storageService.get<CustomTheme[]>(STORAGE_KEYS.customThemes, []);

    // Um tema gravado sem cores — de uma versão anterior ou de um ficheiro
    // mexido à mão — rebentaria a derivação. Descarta-se em silêncio.
    set({
      themes: saved.filter(
        (theme) =>
          typeof theme?.id === 'string' &&
          typeof theme.accent === 'string' &&
          typeof theme.background === 'string',
      ),
    });
  },
}));
