import { create } from 'zustand';

import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  DEFAULT_WEB_SEARCH_SETTINGS,
  type WebSearchProviderChoice,
  type WebSearchSettings,
} from '@/types/web-search-settings';

/**
 * Preferências de pesquisa web (Peça 18; provedor SearXNG no item 28,
 * 20/08/2026).
 *
 * **Só estado e persistência** — mesmo padrão da `useNewsSettingsStore`. A
 * conversão das preferências no provedor em vigor está no hook
 * `useWebSearchSettings`. Esta store guarda e hidrata, só.
 *
 * **A chave da Brave vai para o cofre do sistema** (Credential Manager no
 * Windows, Keychain no macOS), nunca para o storage normal. Sem cofre
 * (browser, Android), mantém-se no storage — o comportamento de sempre, com
 * o aviso na interface. `provider` e `searxngBaseUrl` não são segredo
 * nenhum — vão sempre para o storage normal, com ou sem cofre.
 */
interface WebSearchSettingsState {
  settings: WebSearchSettings;

  setProvider: (provider: WebSearchProviderChoice) => void;
  setApiKey: (apiKey: string) => void;
  /** Esquece a chave e volta ao simulado. */
  forgetKey: () => void;
  setSearxngBaseUrl: (baseUrl: string) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useWebSearchSettingsStore = create<WebSearchSettingsState>((set, get) => ({
  settings: DEFAULT_WEB_SEARCH_SETTINGS,

  setProvider: (provider) => {
    set({ settings: { ...get().settings, provider } });

    logService.audit(`Escolher o provedor de pesquisa web: ${provider}`, 'executado');
    void get().persist();
  },

  setApiKey: (apiKey) => {
    set({ settings: { ...get().settings, apiKey: apiKey.trim() } });

    logService.audit(
      apiKey.trim().length > 0 ? 'Guardar a chave da Brave Search' : 'Apagar a chave da Brave Search',
      'executado',
    );
    void get().persist();
  },

  forgetKey: () => {
    const provider = get().settings.provider === 'brave' ? 'mock' : get().settings.provider;
    set({ settings: { ...get().settings, apiKey: '', provider } });

    logService.audit('Apagar a chave da Brave Search e voltar ao simulado', 'executado');
    void get().persist();
  },

  setSearxngBaseUrl: (baseUrl) => {
    set({ settings: { ...get().settings, searxngBaseUrl: baseUrl.trim() } });
    void get().persist();
  },

  persist: async () => {
    const { settings } = get();
    const adapter = getPlatformAdapter();

    if (adapter.capabilities.secretVault) {
      // Cofre disponível: a chave vai para o cofre; o storage guarda o
      // resto (provedor, endereço do SearXNG), nunca a chave.
      await storageService.set(STORAGE_KEYS.webSearchSettings, { ...settings, apiKey: '' });

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

    // Formato antigo: só `apiKey`, sem `provider`. Sem `provider` gravado
    // mas com uma chave já guardada, presume-se Brave — para não apagar a
    // escolha de quem configurou isto antes do item 28.
    const provider: WebSearchProviderChoice =
      saved?.provider === 'searxng' || saved?.provider === 'brave' || saved?.provider === 'mock'
        ? saved.provider
        : apiKey.length > 0
          ? 'brave'
          : 'mock';

    const searxngBaseUrl =
      typeof saved?.searxngBaseUrl === 'string' && saved.searxngBaseUrl.trim()
        ? saved.searxngBaseUrl
        : DEFAULT_WEB_SEARCH_SETTINGS.searxngBaseUrl;

    set({ settings: { provider, apiKey, searxngBaseUrl } });
  },
}));
