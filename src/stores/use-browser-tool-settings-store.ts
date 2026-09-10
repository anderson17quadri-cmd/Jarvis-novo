import { create } from 'zustand';

import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  DEFAULT_BROWSER_TOOL_SETTINGS,
  type BrowserToolSettings,
} from '@/types/browser-tool-settings';

/**
 * Interruptor do navegador controlado pelo assistente (Peça 19, Lote 5).
 *
 * **Desligado por omissão, sempre** — a pessoa liga-o de propósito, na
 * Personalização/Privacidade, nunca o sistema sozinho. Só estado e
 * persistência; a auditoria de cada mudança fica aqui porque é a própria
 * decisão de ligar/desligar que interessa registar, não só o uso.
 */
interface BrowserToolSettingsState {
  settings: BrowserToolSettings;

  setEnabled: (enabled: boolean) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useBrowserToolSettingsStore = create<BrowserToolSettingsState>((set, get) => ({
  settings: DEFAULT_BROWSER_TOOL_SETTINGS,

  setEnabled: (enabled) => {
    set({ settings: { enabled } });

    logService.audit(
      `${enabled ? 'Ligar' : 'Desligar'} o navegador controlado pelo assistente`,
      'executado',
    );
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.browserToolSettings, get().settings);
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<BrowserToolSettings> | null>(
      STORAGE_KEYS.browserToolSettings,
      null,
    );

    set({ settings: { ...DEFAULT_BROWSER_TOOL_SETTINGS, ...saved } });
  },
}));
