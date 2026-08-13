import { create } from 'zustand';

import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { DEFAULT_OBSIDIAN_SETTINGS, type ObsidianSettings } from '@/types/obsidian-settings';

/**
 * Preferências do vault Obsidian (Peça 17).
 *
 * Só estado e persistência — mesmo padrão da `useMusicSettingsStore`. Ligar
 * a escolha ao serviço (`obsidianService.refreshNotes()`) é do hook
 * `useObsidianSettings`, não desta store.
 */
interface ObsidianSettingsState {
  settings: ObsidianSettings;

  setRoot: (rootPath: string, rootName: string) => void;
  clearRoot: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useObsidianSettingsStore = create<ObsidianSettingsState>((set, get) => ({
  settings: DEFAULT_OBSIDIAN_SETTINGS,

  setRoot: (rootPath, rootName) => {
    const settings: ObsidianSettings = { rootPath, rootName };
    set({ settings });

    logService.audit(`Escolher o vault Obsidian: ${rootName}`, 'executado');
    void get().persist();
  },

  clearRoot: () => {
    const settings: ObsidianSettings = DEFAULT_OBSIDIAN_SETTINGS;
    set({ settings });

    logService.audit('Limpar o vault Obsidian', 'executado');
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.obsidianSettings, get().settings);
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<ObsidianSettings> | null>(
      STORAGE_KEYS.obsidianSettings,
      null,
    );

    const settings: ObsidianSettings = {
      ...DEFAULT_OBSIDIAN_SETTINGS,
      ...saved,
    };

    set({ settings });
  },
}));
