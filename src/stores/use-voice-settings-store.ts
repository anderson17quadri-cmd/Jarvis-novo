import { create } from 'zustand';
import { getPlatformAdapter } from '@/platform';

import { voiceService, type VoiceSelection } from '@/services/voice-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

interface VoiceSettingsState {
  selection: VoiceSelection;
  openAiKey: string;
  saveOpenAiKey: (key: string) => Promise<boolean>;
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

const DEFAULT_SELECTION: VoiceSelection = { kind: 'openai', voice: 'cedar' };

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
  openAiKey: '',
  saveOpenAiKey: async (key) => {
    const value = key.trim();
    const adapter = getPlatformAdapter();
    if (adapter.capabilities.secretVault) {
      const saved = value
        ? await adapter.secretSet('openai-voice-api-key', value)
        : await adapter.secretDelete('openai-voice-api-key');
      if (!saved) return false;
    }
    set({ openAiKey: value });
    voiceService.configureOpenAi(value);
    return true;
  },
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

    const previous = saved?.selection?.kind
      ? saved.selection
      : saved?.kind
        ? saved
        : DEFAULT_SELECTION;
    const selection = previous.kind === 'clonada' ||
      (previous.kind === 'openai' && previous.voice !== 'cedar' && previous.voice !== 'marin')
      ? DEFAULT_SELECTION : previous;
    const micAlwaysOn = saved?.micAlwaysOn === true;
    const wakeWordEnabled = saved?.wakeWordEnabled === true;
    const wakeWord = typeof saved?.wakeWord === 'string' && saved.wakeWord.trim()
      ? saved.wakeWord.trim()
      : DEFAULT_WAKE_WORD;

    const adapter = getPlatformAdapter();
    const openAiKey = adapter.capabilities.secretVault
      ? (await adapter.secretGet('openai-voice-api-key')) ?? '' : '';
    set({ selection, openAiKey, micAlwaysOn, wakeWordEnabled, wakeWord });
    voiceService.configureOpenAi(openAiKey);
    voiceService.setSelection(selection);
    if (previous.kind === 'clonada') await get().persist();
  },
}));
