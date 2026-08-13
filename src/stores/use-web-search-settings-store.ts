import { create } from 'zustand';

import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { DEFAULT_WEB_SEARCH_SETTINGS, type WebSearchSettings } from '@/types/web-search-settings';

/**
 * Preferências de pesquisa web (Peça 18).
 *
 * **Só estado e persistência** — mesmo padrão da `useNewsSettingsStore`. A
 * conversão das preferências no provedor em vigor está no hook
 * `useWebSearchSettings`. Esta store guarda e hidrata, só.
 *
 * **A chave vai para o cofre do sistema** (Credential Manager no Windows,
 * Keychain no macOS), nunca para o storage normal. Sem cofre (browser,
 * Android), mantém-se no storage — o comportamento de sempre, com o aviso na
 * interface. Não há migração para correr: a pesquisa web real é nova, por isso
 * nunca houve chave em texto simples para resgatar.
 */
interface WebSearchSettingsState {
  settings: WebSearchSettings;

  setApiKey: (apiKey: string) => void;
  /** Esquece a chave e volta ao simulado. */
  forgetKey: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useWebSearchSettingsStore = create<WebSearchSettingsState>((set, get) => ({
  settings: DEFAULT_WEB_SEARCH_SETTINGS,

  setApiKey: (apiKey) => {
    const settings: WebSearchSettings = { apiKey: apiKey.trim() };
    set({ settings });

    logService.audit(
      apiKey.trim().length > 0 ? 'Guardar a chave da Brave Search' : 'Apagar a chave da Brave Search',
      'executado',
    );
    void get().persist();
  },

  forgetKey: () => {
    const settings: WebSearchSettings = { apiKey: '' };
    set({ settings });

    logService.audit('Apagar a chave da Brave Search e voltar ao simulado', 'executado');
    void get().persist();
  },

  persist: async () => {
    const { settings } = get();
    const adapter = getPlatformAdapter();

    if (adapter.capabilities.secretVault) {
      // Cofre disponível: a chave vai para o cofre; o storage não guarda nada.
      await storageService.set(STORAGE_KEYS.webSearchSettings, DEFAULT_WEB_SEARCH_SETTINGS);

      if (settings.apiKey) {
        await adapter.secretSet('web-search-api-key', settings.apiKey);
      } else {
        await adapter.secretDelete('web-search-api-key');
      }
    } else {
      // Sem cofre: comportamento de sempre — a chave no storage.
      await storageService.set(STORAGE_KEYS.webSearchSettings, settings);
    }
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<WebSearchSettings> | null>(
      STORAGE_KEYS.webSearchSettings,
      null,
    );

    const adapter = getPlatformAdapter();
    let apiKey = '';

    if (adapter.capabilities.secretVault) {
      apiKey = (await adapter.secretGet('web-search-api-key')) ?? '';
    } else {
      apiKey = typeof saved?.apiKey === 'string' ? saved.apiKey : '';
    }

    set({ settings: { apiKey } });
  },
}));
