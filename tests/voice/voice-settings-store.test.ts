import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPlatformAdapter } from '@/platform';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

import { voiceService } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

beforeEach(() => {
  localStorage.clear();
  useVoiceSettingsStore.setState({ selection: { kind: 'auto' } });
  voiceService.setSelection({ kind: 'auto' });
});

afterEach(() => vi.restoreAllMocks());

describe('useVoiceSettingsStore', () => {
  it('sem nada gravado, prepara Cedar da OpenAI sem inventar uma chave', async () => {
    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'openai', voice: 'cedar' });
    expect(useVoiceSettingsStore.getState().openAiKey).toBe('');
  });

  it('sobrevive a recarregar, e o voiceService fica a par', async () => {
    useVoiceSettingsStore.getState().setSelection({ kind: 'sistema', voiceURI: 'duarte-natural' });
    await useVoiceSettingsStore.getState().persist();

    useVoiceSettingsStore.setState({ selection: { kind: 'auto' } });
    voiceService.setSelection({ kind: 'auto' });

    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().selection).toEqual({
      kind: 'sistema',
      voiceURI: 'duarte-natural',
    });
  });

  it('migra uma voz clonada para OpenAI e preserva as preferências do microfone', async () => {
    useVoiceSettingsStore.getState().setSelection({ kind: 'clonada', nome: 'Ana Florence' });
    useVoiceSettingsStore.getState().setMicAlwaysOn(true);
    await useVoiceSettingsStore.getState().persist();

    useVoiceSettingsStore.setState({ selection: { kind: 'auto' } });

    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'openai', voice: 'cedar' });
    expect(useVoiceSettingsStore.getState().micAlwaysOn).toBe(true);
  });

  it('a chave vai para o cofre, nunca para o armazenamento de preferências', async () => {
    const adapter = getPlatformAdapter();
    vi.spyOn(adapter, 'capabilities', 'get').mockReturnValue({ ...adapter.capabilities, secretVault: true });
    const save = vi.spyOn(adapter, 'secretSet').mockResolvedValue(true);
    expect(await useVoiceSettingsStore.getState().saveOpenAiKey('teste-secreto')).toBe(true);
    await useVoiceSettingsStore.getState().persist();
    expect(save).toHaveBeenCalledWith('openai-voice-api-key', 'teste-secreto');
    const stored = await storageService.get(STORAGE_KEYS.voiceSettings, null);
    expect(JSON.stringify(stored)).not.toContain('teste-secreto');
  });

  it('falhar a escrita no cofre mantém a chave anterior e comunica a falha', async () => {
    const adapter = getPlatformAdapter();
    vi.spyOn(adapter, 'capabilities', 'get').mockReturnValue({ ...adapter.capabilities, secretVault: true });
    vi.spyOn(adapter, 'secretSet').mockResolvedValue(false);
    useVoiceSettingsStore.setState({ openAiKey: 'anterior' });
    expect(await useVoiceSettingsStore.getState().saveOpenAiKey('nova')).toBe(false);
    expect(useVoiceSettingsStore.getState().openAiKey).toBe('anterior');
  });

  it('a wake word (palavra e interruptor) sobrevive a recarregar — 24.3', async () => {
    useVoiceSettingsStore.getState().setWakeWord('Computador');
    useVoiceSettingsStore.getState().setWakeWordEnabled(true);
    await useVoiceSettingsStore.getState().persist();

    useVoiceSettingsStore.setState({ wakeWord: 'Sentinela', wakeWordEnabled: false });

    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().wakeWord).toBe('Computador');
    expect(useVoiceSettingsStore.getState().wakeWordEnabled).toBe(true);
  });

  it('sem nada gravado, hidrata a wake word por omissão: desligada, "Sentinela"', async () => {
    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().wakeWord).toBe('Sentinela');
    expect(useVoiceSettingsStore.getState().wakeWordEnabled).toBe(false);
  });
});
