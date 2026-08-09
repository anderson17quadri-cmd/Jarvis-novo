import { create } from 'zustand';

import { voiceService, type VoiceSelection } from '@/services/voice-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

/**
 * Qual voz de síntese usar (Parte 7.1 §Voz / §Voz clonada local).
 *
 * Guarda a `VoiceSelection` inteira, não só um URI — desde que há também a
 * opção de voz clonada (local, `voice-clone-service/`), "qual voz" já não é
 * só um identificador do sistema operativo, é também "sistema ou serviço
 * local, e dentro deste, qual nome".
 */
interface VoiceSettingsState {
  selection: VoiceSelection;

  setSelection: (selection: VoiceSelection) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const AUTO: VoiceSelection = { kind: 'auto' };

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  selection: AUTO,

  setSelection: (selection) => {
    set({ selection });
    voiceService.setSelection(selection);
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.voiceSettings, get().selection);
  },

  hydrate: async () => {
    const saved = await storageService.get<VoiceSelection | null>(STORAGE_KEYS.voiceSettings, null);

    const selection = saved?.kind ? saved : AUTO;
    set({ selection });
    voiceService.setSelection(selection);
  },
}));
