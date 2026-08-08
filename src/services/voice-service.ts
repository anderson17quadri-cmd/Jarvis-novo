/**
 * Voz — reconhecimento e síntese, pela Web Speech API.
 *
 * Degrada com elegância a sério: num ambiente sem a API, `isSupported` devolve
 * `false` e a interface esconde o microfone, em vez de mostrar um botão que não
 * faz nada ou lançar um erro.
 *
 * **O reconhecimento precisa de um serviço de voz por trás**, não só do
 * construtor existir. O Chrome tem-no porque fala com os servidores da
 * Google; o WebView2 (o motor do Tauri no Windows) é Chromium mas não traz
 * esse serviço — por isso o botão pode reagir e o microfone nunca chegar a
 * ouvir nada, sem erro nenhum visível. É por isto que o código de erro do
 * navegador (`event.error`) se regista sempre: sem ele, "não funciona" fica
 * sem forma de se distinguir de "não tem permissão" ou "não há serviço".
 */

/** O reconhecimento de voz não está nos tipos padrão do DOM. */
interface SpeechRecognitionResultLike {
  readonly transcript: string;
}

interface SpeechRecognitionEventLike {
  readonly results: {
    readonly length: number;
    readonly [index: number]: { readonly [index: number]: SpeechRecognitionResultLike };
  };
}

/**
 * O código de erro do navegador, tal como a especificação o define:
 * `'no-speech'`, `'aborted'`, `'audio-capture'`, `'network'`,
 * `'not-allowed'`, `'service-not-allowed'`, `'bad-grammar'` ou
 * `'language-not-supported'` — mas em `string`, para não depender do
 * `SpeechRecognitionErrorCode` do DOM real, que varia consoante a `lib` do
 * TypeScript configurada.
 */
export type SpeechRecognitionErrorKind = string;

interface SpeechRecognitionErrorEventLike {
  readonly error: SpeechRecognitionErrorKind;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const candidate =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
      .webkitSpeechRecognition;

  return candidate ?? null;
}

export interface VoiceCallbacks {
  readonly onTranscript: (text: string) => void;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
  /** O código que o navegador deu, quando há um — nunca inventado. */
  readonly onError?: (kind: SpeechRecognitionErrorKind | null) => void;
}

export class VoiceService {
  private recognition: SpeechRecognitionLike | null = null;
  private listening = false;

  get isRecognitionSupported(): boolean {
    return getRecognitionConstructor() !== null;
  }

  get isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get isListening(): boolean {
    return this.listening;
  }

  /** Liga ou desliga a escuta. Devolve o estado resultante. */
  toggleListening(callbacks: VoiceCallbacks): boolean {
    if (this.listening) {
      this.stopListening();
      return false;
    }
    return this.startListening(callbacks);
  }

  private startListening(callbacks: VoiceCallbacks): boolean {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return false;

    try {
      const recognition = new Recognition();
      recognition.lang = 'pt-PT';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event): void => {
        const last = event.results[event.results.length - 1];
        const text = last?.[0]?.transcript.trim();
        if (text) callbacks.onTranscript(text);
      };

      recognition.onend = (): void => {
        this.listening = false;
        this.recognition = null;
        callbacks.onEnd?.();
      };

      recognition.onerror = (event): void => {
        this.listening = false;
        this.recognition = null;
        callbacks.onError?.(event?.error ?? null);
      };

      recognition.start();
      this.recognition = recognition;
      this.listening = true;
      callbacks.onStart?.();
      return true;
    } catch (error) {
      /*
       * O `start()` pode recusar de forma síncrona — sem permissão de
       * microfone, ou sem o serviço de reconhecimento por trás do construtor
       * (o caso do WebView2, ver a nota no topo do ficheiro). Sem chamar
       * `onError` aqui, isto era um botão que não faz nada, sem pista
       * nenhuma de porquê — o próprio defeito que se estava a corrigir.
       */
      this.listening = false;
      this.recognition = null;
      callbacks.onError?.(error instanceof Error ? error.message : 'start-falhou');
      return false;
    }
  }

  stopListening(): void {
    try {
      this.recognition?.stop();
    } catch {
      /* já parado */
    }
    this.listening = false;
    this.recognition = null;
  }

  /**
   * Lê um texto em voz alta, em português europeu.
   * Devolve `false` se não foi possível — quem chama não precisa de reagir.
   */
  speak(text: string, callbacks?: { onStart?: () => void; onEnd?: () => void }): boolean {
    if (!this.isSynthesisSupported) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-PT';
      utterance.rate = 1.02;
      utterance.pitch = 0.95;

      const portugueseVoices = speechSynthesis.getVoices().filter((voice) => /^pt/i.test(voice.lang));
      const preferred =
        portugueseVoices.find((voice) => /male|masc|duarte|ricardo|joaquim/i.test(voice.name)) ??
        portugueseVoices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onstart = (): void => callbacks?.onStart?.();
      utterance.onend = (): void => callbacks?.onEnd?.();
      utterance.onerror = (): void => callbacks?.onEnd?.();

      // Cancelar primeiro: falas sobrepostas ficam impercetíveis.
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  stopSpeaking(): void {
    if (!this.isSynthesisSupported) return;
    try {
      speechSynthesis.cancel();
    } catch {
      /* nada a fazer */
    }
  }
}

export const voiceService = new VoiceService();
