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
  /**
   * Microfone sempre ativo (14/08/2026): o modo conversa fica ligado e
   * reengata-se sozinho, mesmo a atravessar reinícios — é a forma de o
   * microfone "estar sempre a ouvir" sem carregar no botão a cada arranque.
   */
  micAlwaysOn: boolean;

  setSelection: (selection: VoiceSelection) => void;
  setMicAlwaysOn: (enabled: boolean) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/**
 * Voz por omissão, para quem nunca escolheu nenhuma (primeiro arranque, ou
 * `hydrate` sem nada guardado): "Alison Dietlinde", uma das vozes prontas do
 * XTTS-v2, em vez de `{ kind: 'auto' }` (a voz robótica do sistema). Só
 * entra em jogo se o serviço local (`voice-clone-service/`) estiver a
 * correr — sem ele, `speakClonada` falha em silêncio e nada soa; quem nunca
 * o instalou não fica sem voz nenhuma, só sem áudio até o instalar ou
 * escolher outra em Definições.
 */
const DEFAULT_SELECTION: VoiceSelection = { kind: 'clonada', nome: 'Alison Dietlinde' };

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  selection: DEFAULT_SELECTION,
  micAlwaysOn: false,

  setSelection: (selection) => {
    set({ selection });
    voiceService.setSelection(selection);
    void get().persist();
  },

  setMicAlwaysOn: (enabled) => {
    set({ micAlwaysOn: enabled });
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.voiceSettings, {
      selection: get().selection,
      micAlwaysOn: get().micAlwaysOn,
    });
  },

  hydrate: async () => {
    // Formato antigo: só a `VoiceSelection` (ex.: `{ kind, nome }`). Novo:
    // `{ selection, micAlwaysOn }`. O `&` cobre as duas leituras sem migração.
    const saved = await storageService.get<
      (VoiceSelection & { selection?: VoiceSelection; micAlwaysOn?: boolean }) | null
    >(STORAGE_KEYS.voiceSettings, null);

    const selection = saved?.selection?.kind
      ? saved.selection
      : saved?.kind
        ? saved
        : DEFAULT_SELECTION;
    const micAlwaysOn = saved?.micAlwaysOn === true;

    set({ selection, micAlwaysOn });
    voiceService.setSelection(selection);
  },
}));
