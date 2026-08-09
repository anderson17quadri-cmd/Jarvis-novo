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

/**
 * O serviço local de voz clonada (Parte 7.1 §Voz clonada local,
 * `voice-clone-service/`) — Python + XTTS-v2, à parte da app, como o Ollama.
 * Porta fixa: é uma única máquina, um único utilizador, sem necessidade de
 * configurar nada.
 */
const CLONE_SERVICE_URL = 'http://127.0.0.1:8090';

/** Uma das vozes prontas do XTTS-v2 (ver `GET /vozes` no serviço local). */
export interface CloneVoiceInfo {
  readonly nome: string;
  readonly descricao: string;
}

export interface CloneServiceInfo {
  /** `false` quando o serviço local não está a correr, ou não responde. */
  readonly disponivel: boolean;
  /** Se já há uma amostra gravada em `voices/referencia.wav`, no serviço. */
  readonly vozPropriaGravada: boolean;
  readonly vozesProntas: readonly CloneVoiceInfo[];
}

/**
 * Qual voz usar, ao ler algo em voz alta.
 *
 * - `'auto'` — a escolha automática de sempre (uma voz do sistema).
 * - `'sistema'` — uma voz específica das que o sistema operativo já tem.
 * - `'clonada'` — o serviço local de voz clonada. `nome: null` é a voz do
 *   próprio utilizador (a amostra gravada); um nome é uma das vozes prontas
 *   do modelo (ver `CloneVoiceInfo`), sem clonagem nenhuma.
 */
export type VoiceSelection =
  | { readonly kind: 'auto' }
  | { readonly kind: 'sistema'; readonly voiceURI: string }
  | { readonly kind: 'clonada'; readonly nome: string | null };

const VOICE_SELECTION_AUTO: VoiceSelection = { kind: 'auto' };

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

  /** A voz escolhida de propósito (Parte 7.1 §Voz). Ver `VoiceSelection`. */
  private selection: VoiceSelection = VOICE_SELECTION_AUTO;

  /** O áudio da voz clonada atualmente a tocar, se houver — para `stopSpeaking`. */
  private cloneAudio: HTMLAudioElement | null = null;

  setSelection(selection: VoiceSelection): void {
    this.selection = selection;
  }

  /**
   * Pergunta ao serviço local (`voice-clone-service/`) se está a correr, se
   * já há uma voz gravada, e a lista de vozes prontas do modelo.
   *
   * Falha em silêncio: não estar a correr é o estado normal para quem nunca
   * o instalou, não um erro para mostrar. Timeout curto porque, se não
   * responder depressa, é porque não está lá — não vale a pena a UI esperar.
   */
  async getCloneServiceInfo(): Promise<CloneServiceInfo> {
    const naoDisponivel: CloneServiceInfo = {
      disponivel: false,
      vozPropriaGravada: false,
      vozesProntas: [],
    };

    try {
      const [saude, vozes] = await Promise.all([
        fetch(`${CLONE_SERVICE_URL}/health`, { signal: AbortSignal.timeout(1_500) }),
        fetch(`${CLONE_SERVICE_URL}/vozes`, { signal: AbortSignal.timeout(1_500) }),
      ]);
      if (!saude.ok || !vozes.ok) return naoDisponivel;

      const saudeJson = (await saude.json()) as { voz_configurada?: boolean };
      const vozesJson = (await vozes.json()) as { vozes?: Record<string, string> };

      return {
        disponivel: true,
        vozPropriaGravada: Boolean(saudeJson.voz_configurada),
        vozesProntas: Object.entries(vozesJson.vozes ?? {}).map(([nome, descricao]) => ({
          nome,
          descricao,
        })),
      };
    } catch {
      return naoDisponivel;
    }
  }

  /** Fala pelo serviço local de voz clonada. `nome: null` é a voz gravada do utilizador. */
  private async speakClonada(
    text: string,
    nome: string | null,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
  ): Promise<void> {
    try {
      const resposta = await fetch(`${CLONE_SERVICE_URL}/falar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: text, ...(nome ? { voz: nome } : {}) }),
      });
      if (!resposta.ok) throw new Error(`o serviço de voz local devolveu ${resposta.status}`);

      const url = URL.createObjectURL(await resposta.blob());

      this.cloneAudio?.pause();
      const audio = new Audio(url);
      this.cloneAudio = audio;

      const limpar = (): void => {
        URL.revokeObjectURL(url);
        if (this.cloneAudio === audio) this.cloneAudio = null;
      };

      audio.onplay = () => callbacks?.onStart?.();
      audio.onended = () => {
        limpar();
        callbacks?.onEnd?.();
      };
      audio.onerror = () => {
        limpar();
        callbacks?.onEnd?.();
      };

      await audio.play();
    } catch {
      // O serviço local pode não estar a correr — quem chama (`useVoice`,
      // o botão "testar") não tem aqui uma forma síncrona de reportar isto;
      // a UI de definições confirma a disponibilidade à parte, com
      // `getCloneServiceInfo`.
      callbacks?.onEnd?.();
    }
  }

  /**
   * As vozes portuguesas que o sistema conhece.
   *
   * **Não inventa vozes.** Isto só mostra o que o Windows (ou o browser) já
   * tem instalado — para teres mais do que a voz robótica de sempre, sem
   * pagar nenhuma API, é ires a Definições → Hora e idioma → Voz, no Windows,
   * e instalares as vozes "Natural" em português. O JARVIS lista o que
   * encontrar; não sabe transformar uma voz fraca numa melhor.
   */
  get availableVoices(): readonly SpeechSynthesisVoice[] {
    if (!this.isSynthesisSupported) return [];
    return speechSynthesis.getVoices().filter((voice) => /^pt/i.test(voice.lang));
  }

  /**
   * Lê um texto em voz alta, em português europeu.
   *
   * `selectionOverride` serve só o botão de "testar" nas configurações —
   * ouvir uma voz sem a tornar a preferida. Sem argumento, usa a preferida
   * (ver `setSelection`), ou a escolha automática se nunca foi guardada
   * nenhuma.
   *
   * Uma voz clonada fala de forma assíncrona (pede áudio ao serviço local) —
   * por isso isto devolve só se o pedido *arrancou*, não se chegou a soar.
   * `callbacks.onEnd` dispara sempre, mesmo que o serviço local falhe, para
   * quem estiver a usar isto para mudar de estado (ex.: `AICore`) não ficar
   * preso em "a falar" para sempre.
   */
  speak(
    text: string,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    selectionOverride?: VoiceSelection,
  ): boolean {
    const selection = selectionOverride ?? this.selection;

    if (selection.kind === 'clonada') {
      void this.speakClonada(text, selection.nome, callbacks);
      return true;
    }

    return this.speakSistema(text, callbacks, selection.kind === 'sistema' ? selection.voiceURI : undefined);
  }

  private speakSistema(
    text: string,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    voiceURIOverride?: string,
  ): boolean {
    if (!this.isSynthesisSupported) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-PT';
      utterance.rate = 1.02;
      utterance.pitch = 0.95;

      const portugueseVoices = this.availableVoices;
      const chosen = voiceURIOverride
        ? portugueseVoices.find((voice) => voice.voiceURI === voiceURIOverride)
        : undefined;
      const preferred =
        chosen ??
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
    if (this.isSynthesisSupported) {
      try {
        speechSynthesis.cancel();
      } catch {
        /* nada a fazer */
      }
    }

    this.cloneAudio?.pause();
    this.cloneAudio = null;
  }
}

export const voiceService = new VoiceService();
