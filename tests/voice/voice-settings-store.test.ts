import { beforeEach, describe, expect, it } from 'vitest';

import { voiceService } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

beforeEach(() => {
  localStorage.clear();
  useVoiceSettingsStore.setState({ selection: { kind: 'auto' } });
  voiceService.setSelection({ kind: 'auto' });
});

describe('useVoiceSettingsStore', () => {
  it('sem nada gravado, hidrata para a voz por omissão (Alison Dietlinde, clonada)', async () => {
    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'clonada', nome: 'Alison Dietlinde' });
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

  it('sobrevive a recarregar com uma voz clonada', async () => {
    useVoiceSettingsStore.getState().setSelection({ kind: 'clonada', nome: 'Ana Florence' });
    await useVoiceSettingsStore.getState().persist();

    useVoiceSettingsStore.setState({ selection: { kind: 'auto' } });

    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'clonada', nome: 'Ana Florence' });
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
