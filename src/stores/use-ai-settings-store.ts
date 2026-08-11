import { create } from 'zustand';

import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  DEFAULT_AI_SETTINGS,
  type AiProviderId,
  type AiSettings,
  type DeepSeekModelId,
} from '@/types/ai-provider-settings';

/**
 * Escolha do provedor de IA (Partes 7.1 e 12).
 *
 * **Só estado e persistência.** A conversão das preferências no provedor em
 * vigor está no hook `useAiSettings`, que é quem conhece os provedores e o
 * `aiService`. A store não importa nenhum deles — guarda e hidrata, só.
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
  /** Esquece a chave e volta ao provedor local. */
  forgetKey: () => void;
  /** Esquece a chave da Claude e volta ao provedor local. */
  forgetClaudeKey: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
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

    // Sem a chave no detalhe. Regista-se o facto, não o segredo.
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

  forgetClaudeKey: () => {
    const settings: AiSettings = { ...get().settings, claudeApiKey: '', provider: 'regras' };
    set({ settings });

    logService.audit('Apagar a chave da Claude e voltar ao provedor local', 'executado');
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.aiSettings, get().settings);
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<AiSettings> | null>(
      STORAGE_KEYS.aiSettings,
      null,
    );

    const settings: AiSettings = { ...DEFAULT_AI_SETTINGS, ...saved };
    set({ settings });
    // A aplicação ao aiService é feita pelo hook useAiSettings — a store só
    // repõe o estado, e o efeito trata de converter isso no provedor em vigor.
  },
}));
