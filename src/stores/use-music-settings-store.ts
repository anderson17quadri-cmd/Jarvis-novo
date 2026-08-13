import { create } from 'zustand';

import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { DEFAULT_MUSIC_SETTINGS, type MusicSettings } from '@/types/music-settings';

/**
 * Preferências da música local (Peça 8, lote 2).
 *
 * **Só estado e persistência** — mesmo padrão da `useWeatherSettingsStore`. A
 * conversão das preferências no provedor em vigor está no hook
 * `useMusicSettings`, que é quem conhece o `LocalMusicProvider` e o
 * `musicService`. Esta store guarda e hidrata, só.
 *
 * Não há cofre aqui: o caminho de uma pasta não é um segredo, por isso não
 * finge que é.
 */
interface MusicSettingsState {
  settings: MusicSettings;

  setRoot: (rootPath: string, rootName: string) => void;
  clearRoot: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useMusicSettingsStore = create<MusicSettingsState>((set, get) => ({
  settings: DEFAULT_MUSIC_SETTINGS,

  setRoot: (rootPath, rootName) => {
    const settings: MusicSettings = { rootPath, rootName };
    set({ settings });

    logService.audit(
      `Escolher a pasta de música local: ${rootName}`,
      'executado',
    );
    void get().persist();
  },

  clearRoot: () => {
    const settings: MusicSettings = DEFAULT_MUSIC_SETTINGS;
    set({ settings });

    logService.audit('Limpar a pasta de música local — voltar ao simulado', 'executado');
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.musicSettings, get().settings);
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<MusicSettings> | null>(
      STORAGE_KEYS.musicSettings,
      null,
    );

    const settings: MusicSettings = {
      ...DEFAULT_MUSIC_SETTINGS,
      ...saved,
    };

    set({ settings });
  },
}));
