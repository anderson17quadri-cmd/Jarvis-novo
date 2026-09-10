import { create } from 'zustand';

import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { DEFAULT_NEWS_SETTINGS, type NewsSettings } from '@/types/news-settings';

/**
 * Preferências de notícias (Peça 8, lote 2).
 *
 * **Só estado e persistência** — mesmo padrão da `useAiSettingsStore`. A
 * conversão das preferências no provedor em vigor está no hook
 * `useNewsSettings`. Esta store guarda e hidrata, só.
 *
 * **A chave da NewsAPI vai para o cofre do sistema** (Credential Manager no
 * Windows, Keychain no macOS), nunca para o storage normal. Sem cofre
 * (browser, Android), mantém-se no storage — o comportamento de sempre, com o
 * aviso na interface. Não há migração para correr: a funcionalidade de
 * notícias reais é nova, por isso nunca houve chave em texto simples para
 * resgatar.
 */
interface NewsSettingsState {
  settings: NewsSettings;

  setApiKey: (apiKey: string) => void;
  setCountry: (country: string) => void;
  /** Esquece a chave e volta ao simulado. */
  forgetKey: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** Devolve uma cópia das definições sem a chave secreta. */
function semSegredos(settings: NewsSettings): Omit<NewsSettings, 'apiKey'> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key !== 'apiKey') {
      result[key] = value;
    }
  }
  return result as unknown as Omit<NewsSettings, 'apiKey'>;
}

export const useNewsSettingsStore = create<NewsSettingsState>((set, get) => ({
  settings: DEFAULT_NEWS_SETTINGS,

  setApiKey: (apiKey) => {
    const settings = { ...get().settings, apiKey: apiKey.trim() };
    set({ settings });

    logService.audit(
      apiKey.trim().length > 0 ? 'Guardar a chave da NewsAPI' : 'Apagar a chave da NewsAPI',
      'executado',
    );
    void get().persist();
  },

  setCountry: (country) => {
    const trimmed = country.trim().toLowerCase();
    const settings = {
      ...get().settings,
      country: trimmed.length > 0 ? trimmed : DEFAULT_NEWS_SETTINGS.country,
    };
    set({ settings });
    void get().persist();
  },

  forgetKey: () => {
    const settings: NewsSettings = { ...get().settings, apiKey: '' };
    set({ settings });

    logService.audit('Apagar a chave da NewsAPI e voltar ao simulado', 'executado');
    void get().persist();
  },

  persist: async () => {
    const { settings } = get();
    const adapter = getPlatformAdapter();

    if (adapter.capabilities.secretVault) {
      // Cofre disponível: definições sem segredos → storage, chave → cofre.
      await storageService.set(STORAGE_KEYS.newsSettings, semSegredos(settings));

      if (settings.apiKey) {
        await adapter.secretSet('news-api-key', settings.apiKey);
      } else {
        await adapter.secretDelete('news-api-key');
      }
    } else {
      // Sem cofre: comportamento de sempre — tudo no storage.
      await storageService.set(STORAGE_KEYS.newsSettings, settings);
    }
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<NewsSettings> | null>(
      STORAGE_KEYS.newsSettings,
      null,
    );

    const adapter = getPlatformAdapter();
    let apiKey = '';

    if (adapter.capabilities.secretVault) {
      apiKey = (await adapter.secretGet('news-api-key')) ?? '';
    } else {
      apiKey = typeof saved?.apiKey === 'string' ? saved.apiKey : '';
    }

    // A chave vem do cofre; o que veio do storage só contribui com o país.
    const cleanSaved: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(saved ?? {})) {
      if (chave !== 'apiKey') {
        cleanSaved[chave] = valor;
      }
    }

    const settings: NewsSettings = {
      ...DEFAULT_NEWS_SETTINGS,
      ...cleanSaved,
      apiKey,
    };

    set({ settings });
  },
}));
