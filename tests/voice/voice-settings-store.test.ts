import { beforeEach, describe, expect, it } from 'vitest';

import { voiceService } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

beforeEach(() => {
  localStorage.clear();
  useVoiceSettingsStore.setState({ voiceURI: null });
  voiceService.setPreferredVoice(null);
});

describe('useVoiceSettingsStore', () => {
  it('sem nada gravado, hidrata para a escolha automática', async () => {
    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().voiceURI).toBeNull();
  });

  it('sobrevive a recarregar, e o voiceService fica a par', async () => {
    useVoiceSettingsStore.getState().setVoiceURI('duarte-natural');
    await useVoiceSettingsStore.getState().persist();

    useVoiceSettingsStore.setState({ voiceURI: null });
    voiceService.setPreferredVoice(null);

    await useVoiceSettingsStore.getState().hydrate();

    expect(useVoiceSettingsStore.getState().voiceURI).toBe('duarte-natural');
  });
});
