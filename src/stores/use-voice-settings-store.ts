import { create } from 'zustand';

import { voiceService } from '@/services/voice-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

/**
 * Qual voz de síntese usar (Parte 7.1 §Voz).
 *
 * Guarda só o `voiceURI` — o identificador que o próprio sistema atribui à
 * voz, não o nome (que muda de sítio para sítio) nem a voz em si (que não é
 * serializável). `null` deixa a escolha automática de sempre.
 */
interface VoiceSettingsState {
  voiceURI: string | null;

  setVoiceURI: (voiceURI: string | null) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  voiceURI: null,

  setVoiceURI: (voiceURI) => {
    set({ voiceURI });
    voiceService.setPreferredVoice(voiceURI);
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.voiceSettings, { voiceURI: get().voiceURI });
  },

  hydrate: async () => {
    const saved = await storageService.get<{ voiceURI: string | null } | null>(
      STORAGE_KEYS.voiceSettings,
      null,
    );

    const voiceURI = saved?.voiceURI ?? null;
    set({ voiceURI });
    voiceService.setPreferredVoice(voiceURI);
  },
}));
