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
  wakeWordEnabled: boolean;
  wakeWord: string;

  setSelection: (selection: VoiceSelection) => void;
  setMicAlwaysOn: (enabled: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setWakeWord: (word: string) => void;

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

/**
 * "Jarvis" seria a escolha óbvia, mas o motor local (Vosk, modelo
 * `small-pt-0.3` — a 24.1 de `docs/spec/wake-word-local.md`) tem vocabulário
 * fechado e nunca reconhece essa palavra: confirmado com o modo de gramática
 * do Vosk, que a recusa com "missing in vocabulary" — a transcrição normal
 * ouve sempre "já vi" em vez disso. "Sentinela" está no vocabulário e é rara
 * em conversa normal. Continua configurável (24.3); quem preferir "Jarvis"
 * pode escolhê-la, sabendo que pode não disparar.
 */
const DEFAULT_WAKE_WORD = 'Sentinela';

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  selection: DEFAULT_SELECTION,
  micAlwaysOn: false,
  wakeWordEnabled: false,
  wakeWord: DEFAULT_WAKE_WORD,

  setSelection: (selection) => {
    set({ selection });
    voiceService.setSelection(selection);
    void get().persist();
  },

  setMicAlwaysOn: (enabled) => {
    set({ micAlwaysOn: enabled });
    void get().persist();
  },

  setWakeWordEnabled: (enabled) => {
    set({ wakeWordEnabled: enabled });
    void get().persist();
  },

  setWakeWord: (word) => {
    set({ wakeWord: word });
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.voiceSettings, {
      selection: get().selection,
      micAlwaysOn: get().micAlwaysOn,
      wakeWordEnabled: get().wakeWordEnabled,
      wakeWord: get().wakeWord,
    });
  },

  hydrate: async () => {
    // Formato antigo: só a `VoiceSelection` (ex.: `{ kind, nome }`). Novo:
    // `{ selection, micAlwaysOn }`. O `&` cobre as duas leituras sem migração.
    const saved = await storageService.get<
      (VoiceSelection & {
        selection?: VoiceSelection;
        micAlwaysOn?: boolean;
        wakeWordEnabled?: boolean;
        wakeWord?: string;
      }) | null
    >(STORAGE_KEYS.voiceSettings, null);

    const selection = saved?.selection?.kind
      ? saved.selection
      : saved?.kind
        ? saved
        : DEFAULT_SELECTION;
    const micAlwaysOn = saved?.micAlwaysOn === true;
    const wakeWordEnabled = saved?.wakeWordEnabled === true;
    const wakeWord = typeof saved?.wakeWord === 'string' && saved.wakeWord.trim()
      ? saved.wakeWord.trim()
      : DEFAULT_WAKE_WORD;

    set({ selection, micAlwaysOn, wakeWordEnabled, wakeWord });
    voiceService.setSelection(selection);
  },
}));
