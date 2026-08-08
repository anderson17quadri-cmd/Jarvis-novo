import { create } from 'zustand';

import { aiService } from '@/services/ai-service';
import { RuleProvider } from '@/services/ai-providers/rule-provider';
import { ClaudeProvider } from '@/services/ai-providers/claude-provider';
import { DeepSeekProvider } from '@/services/ai-providers/deepseek-provider';
import { chooseModel } from '@/services/ai-providers/model-choice';
import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
import { type ChainMember } from '@/services/ai-providers/provider-chain';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  DEFAULT_AI_SETTINGS,
  type AiProviderId,
  type AiSettings,
  type DeepSeekModelId,
} from '@/types/ai-provider-settings';
import type { AiProvider } from '@/types/assistant';

/**
 * Escolha do provedor de IA (Partes 7.1 e 12).
 *
 * É esta store que decide qual o provedor em vigor — o `AIService` continua
 * sem saber que provedores existem, e só recebe um (ou uma cadeia).
 *
 * **A chave nunca entra no registo.** O `logService` só regista *que* se mudou
 * de provedor, nunca com que chave: um registo de auditoria que guardasse
 * segredos seria o pior sítio possível para eles estarem.
 */

/**
 * Ordem de reserva da cadeia (Parte 12 §Orquestrador multi-provedor).
 *
 * O escolhido vai sempre primeiro; o resto desta lista segue-se, pela ordem
 * aqui — DeepSeek e Claude antes do Ollama porque, entre um provedor pago já
 * configurado e um modelo local mais fraco, é razoável tentar o melhor
 * primeiro. Trocar esta ordem numa interface de arrastar fica para depois —
 * ver `docs/spec/orquestrador-multi-provedor.md` §3.
 */
const CHAIN_ORDER: readonly AiProviderId[] = ['deepseek', 'claude', 'ollama'];

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

/** Constrói um provedor a partir do que estiver guardado, ou `null` sem configuração. */
function buildProvider(id: AiProviderId, settings: AiSettings): AiProvider | null {
  switch (id) {
    case 'deepseek': {
      if (settings.apiKey.trim().length === 0) return null;
      return new DeepSeekProvider(settings.apiKey, settings.model, undefined, (prompt) =>
        chooseModel(prompt, settings.model, settings.autoModel),
      );
    }
    case 'claude': {
      if (settings.claudeApiKey.trim().length === 0) return null;
      return new ClaudeProvider(settings.claudeApiKey, settings.claudeModel);
    }
    case 'ollama': {
      if (settings.ollamaModel.trim().length === 0) return null;
      return new OllamaProvider(settings.ollamaModel, settings.ollamaBaseUrl);
    }
    case 'regras':
      return null;
  }
}

/**
 * Constrói e liga o provedor (ou a cadeia) descrito pelas preferências.
 *
 * Escolher "Contexto local" de propósito é uma decisão de privacidade — fica
 * só no local, mesmo que haja chaves de outros provedores guardadas de antes.
 * Escolher qualquer outro provedor arranca a cadeia com ele à cabeça e os
 * restantes já configurados a seguir, pela `CHAIN_ORDER`.
 */
function applySettings(settings: AiSettings): void {
  if (settings.provider === 'regras') {
    aiService.setProvider(new RuleProvider());
    return;
  }

  const ordered = [settings.provider, ...CHAIN_ORDER.filter((id) => id !== settings.provider)];
  const chain: ChainMember[] = [];

  for (const id of ordered) {
    const provider = buildProvider(id, settings);
    if (provider) chain.push({ provider, name: provider.name });
  }

  if (chain.length === 0) {
    // O escolhido não tem chave nenhuma configurada — cair no local é melhor
    // do que deixar o assistente mudo à espera de uma configuração que falta.
    aiService.setProvider(new RuleProvider());
    return;
  }

  aiService.setChain(chain);
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

  setClaudeApiKey: (apiKey) => {
    const settings = { ...get().settings, claudeApiKey: apiKey.trim() };
    set({ settings });
    applySettings(settings);

    logService.audit(
      apiKey.trim().length > 0 ? 'Guardar a chave da Claude' : 'Apagar a chave da Claude',
      'executado',
    );
    void get().persist();
  },

  setClaudeModel: (model) => {
    const settings = { ...get().settings, claudeModel: model };
    set({ settings });
    applySettings(settings);
    void get().persist();
  },

  setOllamaModel: (model) => {
    const settings = { ...get().settings, ollamaModel: model.trim() };
    set({ settings });
    applySettings(settings);
    void get().persist();
  },

  setOllamaBaseUrl: (baseUrl) => {
    const trimmed = baseUrl.trim();
    const settings = {
      ...get().settings,
      ollamaBaseUrl: trimmed.length > 0 ? trimmed : DEFAULT_AI_SETTINGS.ollamaBaseUrl,
    };
    set({ settings });
    applySettings(settings);
    void get().persist();
  },

  forgetClaudeKey: () => {
    const settings: AiSettings = { ...get().settings, claudeApiKey: '', provider: 'regras' };
    set({ settings });
    applySettings(settings);

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
    applySettings(settings);
  },
}));
