import { create } from 'zustand';

import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  DEFAULT_AI_SETTINGS,
  type AiProviderId,
  type AiSettings,
  type ChainProviderId,
  type DeepSeekModelId,
} from '@/types/ai-provider-settings';

/**
 * Escolha do provedor de IA (Partes 7.1 e 12).
 *
 * **Só estado e persistência.** A conversão das preferências no provedor em
 * vigor está no hook `useAiSettings`, que é quem conhece os provedores e o
 * `aiService`. A store não importa nenhum deles — guarda e hidrata, só.
 *
 * **A chave da API vai para o cofre do sistema** (Credential Manager no
 * Windows, Keychain no macOS), nunca para o armazenamento local. Se a
 * plataforma não tiver cofre (browser, Android), mantém-se no storage — o
 * mesmo comportamento de sempre, com o aviso na interface.
 *
 * **Migração automática:** quem já tinha a chave em texto simples no storage
 * vê-la movida para o cofre na primeira abertura depois da atualização. O
 * marcador `jarvis-migrated` no próprio cofre impede que a migração corra
 * mais do que uma vez.
 *
 * **A chave nunca entra no registo.** O `logService` só regista *que* se mudou
 * de provedor, nunca com que chave: um registo de auditoria que guardasse
 * segredos seria o pior sítio possível para eles estarem.
 */

interface AiSettingsState {
  settings: AiSettings;

  setProvider: (provider: AiProviderId) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: DeepSeekModelId) => void;
  setAutoModel: (autoModel: boolean) => void;
  setClaudeApiKey: (apiKey: string) => void;
  setClaudeModel: (model: AiSettings['claudeModel']) => void;
  setOllamaModel: (model: string) => void;
  setOllamaBaseUrl: (baseUrl: string) => void;
  setProviderOrder: (providerOrder: readonly ChainProviderId[]) => void;
  /** Esquece a chave e volta ao provedor local. */
  forgetKey: () => void;
  /** Esquece a chave da Claude e volta ao provedor local. */
  forgetClaudeKey: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** Devolve uma cópia das definições sem as chaves secretas. */
function semSegredos(settings: AiSettings): Omit<AiSettings, 'apiKey' | 'claudeApiKey'> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key !== 'apiKey' && key !== 'claudeApiKey') {
      result[key] = value;
    }
  }
  return result as unknown as Omit<AiSettings, 'apiKey' | 'claudeApiKey'>;
}

export const useAiSettingsStore = create<AiSettingsState>((set, get) => ({
  settings: DEFAULT_AI_SETTINGS,

  setProvider: (provider) => {
    const settings = { ...get().settings, provider };
    set({ settings });

    logService.audit(`Passar o assistente ao provedor ${provider}`, 'executado');
    void get().persist();
  },

  setApiKey: (apiKey) => {
    const settings = { ...get().settings, apiKey: apiKey.trim() };
    set({ settings });

    logService.audit(
      apiKey.trim().length > 0 ? 'Guardar a chave da API' : 'Apagar a chave da API',
      'executado',
    );
    void get().persist();
  },

  setAutoModel: (autoModel) => {
    const settings = { ...get().settings, autoModel };
    set({ settings });

    logService.audit(
      autoModel ? 'Ligar a escolha automática de modelo' : 'Desligar a escolha automática de modelo',
      'executado',
    );
    void get().persist();
  },

  setModel: (model) => {
    const settings = { ...get().settings, model };
    set({ settings });
    void get().persist();
  },

  forgetKey: () => {
    const settings: AiSettings = { ...get().settings, apiKey: '', provider: 'regras' };
    set({ settings });

    logService.audit('Apagar a chave da API e voltar ao provedor local', 'executado');
    void get().persist();
  },

  setClaudeApiKey: (apiKey) => {
    const settings = { ...get().settings, claudeApiKey: apiKey.trim() };
    set({ settings });

    logService.audit(
      apiKey.trim().length > 0 ? 'Guardar a chave da Claude' : 'Apagar a chave da Claude',
      'executado',
    );
    void get().persist();
  },

  setClaudeModel: (model) => {
    const settings = { ...get().settings, claudeModel: model };
    set({ settings });
    void get().persist();
  },

  setOllamaModel: (model) => {
    const settings = { ...get().settings, ollamaModel: model.trim() };
    set({ settings });
    void get().persist();
  },

  setOllamaBaseUrl: (baseUrl) => {
    const trimmed = baseUrl.trim();
    const settings = {
      ...get().settings,
      ollamaBaseUrl: trimmed.length > 0 ? trimmed : DEFAULT_AI_SETTINGS.ollamaBaseUrl,
    };
    set({ settings });
    void get().persist();
  },

  setProviderOrder: (providerOrder) => {
    const settings = { ...get().settings, providerOrder };
    set({ settings });

    logService.audit('Reordenar a cadeia de reserva de provedores', 'executado');
    void get().persist();
  },

  forgetClaudeKey: () => {
    const settings: AiSettings = { ...get().settings, claudeApiKey: '', provider: 'regras' };
    set({ settings });

    logService.audit('Apagar a chave da Claude e voltar ao provedor local', 'executado');
    void get().persist();
  },

  persist: async () => {
    const { settings } = get();
    const adapter = getPlatformAdapter();

    if (adapter.capabilities.secretVault) {
      // Cofre disponível: definições sem segredos → storage, chaves → cofre.
      await storageService.set(STORAGE_KEYS.aiSettings, semSegredos(settings));

      if (settings.apiKey) {
        await adapter.secretSet('deepseek-api-key', settings.apiKey);
      } else {
        await adapter.secretDelete('deepseek-api-key');
      }
      if (settings.claudeApiKey) {
        await adapter.secretSet('claude-api-key', settings.claudeApiKey);
      } else {
        await adapter.secretDelete('claude-api-key');
      }
    } else {
      // Sem cofre: comportamento de sempre — tudo no storage.
      await storageService.set(STORAGE_KEYS.aiSettings, settings);
    }
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<AiSettings> | null>(
      STORAGE_KEYS.aiSettings,
      null,
    );

    const adapter = getPlatformAdapter();
    let apiKey = '';
    let claudeApiKey = '';

    if (adapter.capabilities.secretVault) {
      // Migração única: chave que estava em texto simples no storage passa para
      // o cofre. O marcador `jarvis-migrated` no próprio cofre evita correr
      // sempre — e se o cofre não existir (primeira abertura absoluta), também
      // não há nada para migrar.
      const migrated = await adapter.secretGet('jarvis-migrated');

      if (!migrated) {
        const oldKey = typeof saved?.apiKey === 'string' ? saved.apiKey : '';
        const oldClaudeKey = typeof saved?.claudeApiKey === 'string' ? saved.claudeApiKey : '';

        // Só se apaga o texto simples do storage se a cópia para o cofre tiver
        // mesmo corrido. Se uma escrita falhar, a chave fica onde estava e a
        // migração volta a tentar no arranque seguinte — nunca se apaga a única
        // cópia que existe.
        const copiadas =
          (!oldKey || (await adapter.secretSet('deepseek-api-key', oldKey))) &&
          (!oldClaudeKey || (await adapter.secretSet('claude-api-key', oldClaudeKey)));

        if (copiadas) {
          // Limpar as chaves do storage — já estão no cofre.
          if (saved && (oldKey || oldClaudeKey)) {
            const limpo: Record<string, unknown> = {};
            for (const [chave, valor] of Object.entries(saved)) {
              if (chave !== 'apiKey' && chave !== 'claudeApiKey') {
                limpo[chave] = valor;
              }
            }
            await storageService.set(STORAGE_KEYS.aiSettings, limpo);
          }

          await adapter.secretSet('jarvis-migrated', '1');
        }
      }

      apiKey = (await adapter.secretGet('deepseek-api-key')) ?? '';
      claudeApiKey = (await adapter.secretGet('claude-api-key')) ?? '';
    } else {
      // Sem cofre: comportamento de sempre — as chaves vêm do storage.
      apiKey = typeof saved?.apiKey === 'string' ? saved.apiKey : '';
      claudeApiKey = typeof saved?.claudeApiKey === 'string' ? saved.claudeApiKey : '';
    }

    // Remove os campos de chave do que veio do storage: agora vêm do cofre.
    const cleanSaved: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(saved ?? {})) {
      if (chave !== 'apiKey' && chave !== 'claudeApiKey') {
        cleanSaved[chave] = valor;
      }
    }

    const settings: AiSettings = {
      ...DEFAULT_AI_SETTINGS,
      ...cleanSaved,
      apiKey,
      claudeApiKey,
    };

    set({ settings });
  },
}));
