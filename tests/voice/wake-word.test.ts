import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPlatformAdapter } from '@/platform';
import { useVoice } from '@/hooks/use-voice';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { voiceService } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

/**
 * A decisão menos negociável das cinco do §6 (`docs/spec/wake-word-local.md`):
 * ligar a wake word exige o serviço local de voz a correr — sem ele, recusa
 * armar-se e diz porquê, em vez de acordar e deixar o comando cair para o
 * reconhecimento nativo (nuvem) à calada.
 */
describe('wake word — o serviço local de voz é obrigatório para armar', () => {
  let startWakeWord: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useVoiceSettingsStore.setState({ wakeWordEnabled: false, wakeWord: 'Sentinela' });
    startWakeWord = vi.spyOn(getPlatformAdapter(), 'startWakeWord').mockResolvedValue(true);
    vi.spyOn(getPlatformAdapter(), 'stopWakeWord').mockResolvedValue(undefined);
    warn = vi.spyOn(notificationService, 'warn').mockImplementation(() => 'id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recusa armar-se, avisa porquê, e desliga o interruptor sozinho quando o serviço local não responde', async () => {
    vi.spyOn(voiceService, 'localSttReachable').mockResolvedValue(false);

    renderHook(() => useVoice());
    await act(async () => {
      useVoiceSettingsStore.getState().setWakeWordEnabled(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startWakeWord).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Wake word'),
      expect.any(String),
      expect.anything(),
    );
    expect(useVoiceSettingsStore.getState().wakeWordEnabled).toBe(false);
  });

  it('arma normalmente quando o serviço local de voz responde', async () => {
    vi.spyOn(voiceService, 'localSttReachable').mockResolvedValue(true);

    renderHook(() => useVoice());
    await act(async () => {
      useVoiceSettingsStore.getState().setWakeWordEnabled(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startWakeWord).toHaveBeenCalledWith('Sentinela');
    expect(useVoiceSettingsStore.getState().wakeWordEnabled).toBe(true);
  });
});

describe('wake word — cada acordar liga o reconhecimento e fica no registo', () => {
  let toggleListening: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    useVoiceSettingsStore.setState({ wakeWordEnabled: false, wakeWord: 'Sentinela' });
    vi.spyOn(getPlatformAdapter(), 'startWakeWord').mockResolvedValue(true);
    vi.spyOn(getPlatformAdapter(), 'stopWakeWord').mockResolvedValue(undefined);
    vi.spyOn(voiceService, 'localSttReachable').mockResolvedValue(true);
    toggleListening = vi.spyOn(voiceService, 'toggleListening').mockReturnValue(true);
    logService.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('quando a wake word deteta a palavra, liga o reconhecimento e regista em logService', async () => {
    let eventId = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve({ json: () => Promise.resolve({ event_id: eventId }) }),
      ),
    );

    renderHook(() => useVoice());
    await act(async () => {
      useVoiceSettingsStore.getState().setWakeWordEnabled(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    eventId = 1;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(toggleListening).toHaveBeenCalledTimes(1);
    const entradas = logService.list.filter(
      (entrada) => entrada.source === 'voz' && entrada.message.includes('Wake word'),
    );
    expect(entradas).toHaveLength(1);

    vi.unstubAllGlobals();
  });
});
