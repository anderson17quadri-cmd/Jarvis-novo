import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleOllamaPullEvent } from '@/services/ollama-auto-setup';
import { notificationService } from '@/services/notification-service';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import { DEFAULT_AI_SETTINGS } from '@/types/ai-provider-settings';

/**
 * A reação ao descarregamento automático do Llama (item, 20/08/2026):
 * "quero o Llama, sem precisar de adicionar mais nada". O ponto que estes
 * testes provam: só troca o provedor ativo sozinho quando as definições
 * ainda estão tal e qual vieram por omissão — nunca por cima de uma escolha
 * que a pessoa já tenha feito.
 */
let info: ReturnType<typeof vi.spyOn>;
let success: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
  info = vi.spyOn(notificationService, 'info').mockImplementation(() => 'id');
  success = vi.spyOn(notificationService, 'success').mockImplementation(() => 'id');
  warn = vi.spyOn(notificationService, 'warn').mockImplementation(() => 'id');
});

describe('handleOllamaPullEvent', () => {
  it('"started" só avisa — não mexe nas definições', () => {
    handleOllamaPullEvent({ phase: 'started', model: 'llama3.2:3b' });

    expect(info).toHaveBeenCalled();
    expect(useAiSettingsStore.getState().settings).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('"progress" não faz nada — sem spam de notificações a cada byte', () => {
    handleOllamaPullEvent({ phase: 'progress', model: 'llama3.2:3b', percent: 42 });

    expect(info).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('"failed" avisa com o erro — não mexe nas definições', () => {
    handleOllamaPullEvent({ phase: 'failed', model: 'llama3.2:3b', error: 'sem espaço em disco' });

    expect(warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('sem espaço em disco'),
      expect.anything(),
    );
    expect(useAiSettingsStore.getState().settings).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('"done" com as definições ainda por configurar escolhe o Ollama sozinho', () => {
    handleOllamaPullEvent({ phase: 'done', model: 'llama3.2:3b' });

    const { settings } = useAiSettingsStore.getState();
    expect(settings.provider).toBe('ollama');
    expect(settings.ollamaModel).toBe('llama3.2:3b');
    expect(success).toHaveBeenCalledWith(
      expect.stringContaining('pronto'),
      expect.any(String),
      expect.anything(),
    );
  });

  it('"done" com a DeepSeek já configurada nunca troca o provedor', () => {
    useAiSettingsStore.setState({
      settings: { ...DEFAULT_AI_SETTINGS, provider: 'deepseek', apiKey: 'sk-a-verdadeira-chave' },
    });

    handleOllamaPullEvent({ phase: 'done', model: 'llama3.2:3b' });

    const { settings } = useAiSettingsStore.getState();
    expect(settings.provider).toBe('deepseek');
    expect(settings.apiKey).toBe('sk-a-verdadeira-chave');
    // Ainda avisa que o modelo está pronto — só não o torna o ativo.
    expect(success).toHaveBeenCalled();
  });

  it('"done" com um Ollama já escolhido à mão (outro modelo) nunca o substitui', () => {
    useAiSettingsStore.setState({
      settings: { ...DEFAULT_AI_SETTINGS, provider: 'ollama', ollamaModel: 'qwen3:8b' },
    });

    handleOllamaPullEvent({ phase: 'done', model: 'llama3.2:3b' });

    expect(useAiSettingsStore.getState().settings.ollamaModel).toBe('qwen3:8b');
  });
});
