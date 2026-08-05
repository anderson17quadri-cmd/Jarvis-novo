import { create } from 'zustand';

import { aiService } from '@/services/ai-service';
import { RuleProvider } from '@/services/ai-providers/rule-provider';
import { DeepSeekProvider } from '@/services/ai-providers/deepseek-provider';
import { chooseModel } from '@/services/ai-providers/model-choice';
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
 * É esta store que decide qual o provedor em vigor — o `AIService` continua
 * sem saber que provedores existem, e só recebe um.
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
  /** Esquece a chave e volta ao provedor local. */
  forgetKey: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** Constrói e liga o provedor descrito pelas preferências. */
function applySettings(settings: AiSettings): void {
  if (settings.provider === 'deepseek' && settings.apiKey.trim().length > 0) {
    aiService.setProvider(
      new DeepSeekProvider(settings.apiKey, settings.model, undefined, (prompt) =>
        chooseModel(prompt, settings.model, settings.autoModel),
      ),
    );
    return;
  }

  // Sem chave, o remoto não responderia nada de útil. Cair no local é melhor
  // do que deixar o assistente mudo à espera de uma configuração que falta.
  aiService.setProvider(new RuleProvider());
}

export const useAiSettingsStore = create<AiSettingsState>((set, get) => ({
  settings: DEFAULT_AI_SETTINGS,

  setProvider: (provider) => {
    const settings = { ...get().settings, provider };
    set({ settings });
    applySettings(settings);

    logService.audit(`Passar o assistente ao provedor ${provider}`, 'executado');
    void get().persist();
  },

  setApiKey: (apiKey) => {
    const settings = { ...get().settings, apiKey: apiKey.trim() };
    set({ settings });
    applySettings(settings);

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
    applySettings(settings);

    logService.audit(
      autoModel ? 'Ligar a escolha automática de modelo' : 'Desligar a escolha automática de modelo',
      'executado',
    );
    void get().persist();
  },

  setModel: (model) => {
    const settings = { ...get().settings, model };
    set({ settings });
    applySettings(settings);
    void get().persist();
  },

  forgetKey: () => {
    const settings: AiSettings = { ...get().settings, apiKey: '', provider: 'regras' };
    set({ settings });
    applySettings(settings);

    logService.audit('Apagar a chave da API e voltar ao provedor local', 'executado');
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
    applySettings(settings);
  },
}));
