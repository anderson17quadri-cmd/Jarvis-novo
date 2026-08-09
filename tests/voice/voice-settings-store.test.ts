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
});
