import { useEffect } from 'react';

import { aiService } from '@/services/ai-service';
import { RuleProvider } from '@/services/ai-providers/rule-provider';
import { ClaudeProvider } from '@/services/ai-providers/claude-provider';
import { DeepSeekProvider } from '@/services/ai-providers/deepseek-provider';
import { chooseModel } from '@/services/ai-providers/model-choice';
import { OllamaProvider } from '@/services/ai-providers/ollama-provider';
import { type ChainMember } from '@/services/ai-providers/provider-chain';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import type { AiProviderId, AiSettings } from '@/types/ai-provider-settings';
import type { AiProvider } from '@/types/assistant';

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
 * restantes já configurados a seguir, pela `providerOrder` guardada.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store.
 */
export function applyAiSettings(settings: AiSettings): void {
  if (settings.provider === 'regras') {
    aiService.setProvider(new RuleProvider());
    return;
  }

  const ordered = [
    settings.provider,
    ...settings.providerOrder.filter((id) => id !== settings.provider),
  ];
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

/**
 * Aplica as preferências de IA ao serviço sempre que mudam (Parte 7.1).
 *
 * A store gere o estado e a persistência; este hook é a peça que converte
 * essas preferências no provedor em vigor — assim a store não precisa de
 * saber que provedores existem nem de importar o `aiService`.
 *
 * Monta-se uma vez, no início da aplicação, e o efeito trata do resto.
 */
export function useAiSettings(): void {
  const settings = useAiSettingsStore((state) => state.settings);

  useEffect(() => {
    applyAiSettings(settings);
  }, [settings]);
}
