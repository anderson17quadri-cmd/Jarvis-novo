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

/** O resultado de gravar e enviar uma amostra — ver `recordVoiceSample`. */
export type RecordSampleResult =
  | { readonly ok: true; readonly bytes: number }
  | { readonly ok: false; readonly motivo: string };

/** Uma gravação em curso: o resultado final, e a forma de a terminar mais cedo. */
export interface RecordSampleHandle {
  readonly result: Promise<RecordSampleResult>;
  /** Termina a gravação já — o que foi dito até agora é o que se envia. */
  stop(): void;
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

/**
 * `getUserMedia` + `MediaRecorder` — o suficiente para gravar e mandar ao
 * reconhecimento local (`POST /ouvir`, ver `speakClonada` para o par em
 * síntese). Verificado a existir no WebView2, mesmo sem o reconhecimento
 * nativo funcionar.
 */
function hasLocalRecordingSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window
  );
}

/**
 * Deteta quando quem fala parou, para a escuta de um comando não obrigar a
 * esperar sempre o limite de segurança todo — a etapa do "silêncio" que
 * faltava no pipeline (Parte 7.2 §Pipeline completo). Não é deteção de
 * atividade de voz a sério (nenhum modelo, nenhuma distinção de ruído de
 * fundo): só o volume médio do sinal, medido a cada 100ms pela
 * `AnalyserNode` da Web Audio API — que, ao contrário do reconhecimento da
 * Web Speech API, funciona no WebView2. Chama `aoDetetarSilencio` uma vez
 * só, depois de ter havido fala a sério (`minFalaMs`) seguida de silêncio
 * sustentado (`silencioMs`) — para uma pausa a respirar a meio da frase não
 * cortar a gravação cedo de mais.
 */
function vigiarSilencio(
  stream: MediaStream,
  aoDetetarSilencio: () => void,
  opcoes: { limiarVolume?: number; silencioMs?: number; minFalaMs?: number } = {},
): () => void {
  const limiarVolume = opcoes.limiarVolume ?? 0.02;
  const silencioMs = opcoes.silencioMs ?? 1_200;
  const minFalaMs = opcoes.minFalaMs ?? 300;

  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return () => undefined;

  const contexto = new AudioContextConstructor();
  const fonte = contexto.createMediaStreamSource(stream);
  const analisador = contexto.createAnalyser();
  analisador.fftSize = 2_048;
  fonte.connect(analisador);

  const dados = new Uint8Array(analisador.fftSize);
  let falaDetetada = false;
  let inicioFala = 0;
  let ultimoSomAlto = Date.now();
  let jaAvisou = false;

  const intervalo = setInterval(() => {
    if (jaAvisou) return;

    analisador.getByteTimeDomainData(dados);
    let somaQuadrados = 0;
    for (const amostra of dados) {
      const normalizado = (amostra - 128) / 128;
      somaQuadrados += normalizado * normalizado;
    }
    const rms = Math.sqrt(somaQuadrados / dados.length);
    const agora = Date.now();

    if (rms > limiarVolume) {
      ultimoSomAlto = agora;
      if (!falaDetetada) {
        falaDetetada = true;
        inicioFala = agora;
      }
      return;
    }

    if (falaDetetada && agora - inicioFala > minFalaMs && agora - ultimoSomAlto > silencioMs) {
      jaAvisou = true;
      aoDetetarSilencio();
    }
  }, 100);

  return () => {
    clearInterval(intervalo);
    void contexto.close();
  };
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

  /** O relógio de segurança do WebView2 — ver `startListeningNative`. */
  private hangTimer: ReturnType<typeof setTimeout> | null = null;

  /** A gravação em curso para o reconhecimento local, se houver. */
  private localRecorder: MediaRecorder | null = null;

  get isRecognitionSupported(): boolean {
    return getRecognitionConstructor() !== null || hasLocalRecordingSupport();
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
    // Marcado já aqui, de forma síncrona: um segundo clique enquanto se
    // decide qual motor usar (ver `startListening`) tem de parar, não
    // arrancar uma segunda escuta por cima.
    this.listening = true;
    void this.startListening(callbacks);
    return true;
  }

  /**
   * Decide entre o reconhecimento local (`voice-clone-service/`, `POST
   * /ouvir`) e o nativo do motor (Web Speech API).
   *
   * **O nativo está confirmado partido no WebView2** (o motor do Tauri no
   * Windows): o microfone liga (`onaudiostart` dispara), mas nunca chega
   * transcrição, erro nem sequer o fim do reconhecimento — fica preso para
   * sempre, sem pista nenhuma. Por isso o local é a escolha por omissão
   * sempre que o serviço estiver a correr, e o nativo só entra como
   * segunda opção — onde continua a servir (browser, Android), continua a
   * ser usado.
   */
  private async startListening(callbacks: VoiceCallbacks): Promise<void> {
    const local = await this.localSttReachable();
    if (!this.listening) return; // `stopListening` correu enquanto se perguntava

    if (local) {
      await this.startListeningLocal(callbacks);
    } else {
      this.startListeningNative(callbacks);
    }
  }

  /**
   * Pergunta rápida (700ms) se `voice-clone-service/` está a correr e já
   * tem o modelo de reconhecimento carregado. Timeout curto de propósito —
   * se não responder depressa, é porque não está lá, e o botão do
   * microfone não deve ficar à espera disso.
   */
  private async localSttReachable(): Promise<boolean> {
    try {
      const resposta = await fetch(`${CLONE_SERVICE_URL}/health`, { signal: AbortSignal.timeout(700) });
      if (!resposta.ok) return false;
      const saude = (await resposta.json()) as { reconhecimento_carregado?: boolean };
      return Boolean(saude.reconhecimento_carregado);
    } catch {
      return false;
    }
  }

  private startListeningNative(callbacks: VoiceCallbacks): void {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      this.listening = false;
      callbacks.onError?.(null);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = 'pt-PT';
      recognition.continuous = false;
      recognition.interimResults = false;

      const limparHangTimer = (): void => {
        if (this.hangTimer !== null) {
          clearTimeout(this.hangTimer);
          this.hangTimer = null;
        }
      };

      recognition.onresult = (event): void => {
        const last = event.results[event.results.length - 1];
        const text = last?.[0]?.transcript.trim();
        if (text) callbacks.onTranscript(text);
      };

      recognition.onend = (): void => {
        limparHangTimer();
        this.listening = false;
        this.recognition = null;
        callbacks.onEnd?.();
      };

      recognition.onerror = (event): void => {
        limparHangTimer();
        this.listening = false;
        this.recognition = null;
        callbacks.onError?.(event?.error ?? null);
      };

      recognition.start();
      this.recognition = recognition;
      callbacks.onStart?.();

      /*
       * O relógio de segurança: sem o serviço local a correr, o WebView2
       * pode nunca dar sinal nenhum depois de ligar o microfone (ver a nota
       * acima `startListening`). Sem isto, o núcleo ficava em "a ouvir"
       * para sempre, e ninguém percebia porquê.
       */
      this.hangTimer = setTimeout(() => {
        this.hangTimer = null;
        try {
          recognition.stop();
        } catch {
          /* já parado */
        }
        this.listening = false;
        this.recognition = null;
        callbacks.onError?.('timeout');
      }, 9_000);
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
    }
  }

  /**
   * Reconhecimento pelo serviço local (`voice-clone-service/`, `POST
   * /ouvir`) — grava com `MediaRecorder` (isto funciona no WebView2, mesmo
   * a Web Speech API não funcionando) e manda o áudio para transcrever.
   *
   * Para sozinha quando deteta que quem fala já parou (`vigiarSilencio`),
   * sem obrigar a esperar o limite de segurança todo por um comando curto.
   * Continua a dar para parar à mão, a qualquer momento (`stopListening`).
   */
  private async startListeningLocal(callbacks: VoiceCallbacks): Promise<void> {
    if (!hasLocalRecordingSupport()) {
      this.listening = false;
      callbacks.onError?.('audio-capture');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      this.listening = false;
      const nome = error instanceof Error ? error.name : '';
      callbacks.onError?.(nome === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
      return;
    }

    if (!this.listening) {
      // `stopListening` correu enquanto se pedia permissão ao Windows.
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((tipo) =>
      MediaRecorder.isTypeSupported(tipo),
    );
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event): void => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const parado = new Promise<void>((resolve) => {
      recorder.onstop = (): void => resolve();
    });

    recorder.start();
    this.localRecorder = recorder;
    callbacks.onStart?.();

    const limiteDeSeguranca = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, 12_000);

    const pararDeVigiarSilencio = vigiarSilencio(stream, () => {
      if (recorder.state !== 'inactive') recorder.stop();
    });

    await parado;
    clearTimeout(limiteDeSeguranca);
    pararDeVigiarSilencio();
    stream.getTracks().forEach((track) => track.stop());
    this.localRecorder = null;
    this.listening = false;

    /*
     * A partir daqui, processa-se sempre — quer a gravação tenha acabado
     * pelo limite de segurança, pelo silêncio, ou por se ter voltado a
     * carregar no botão (`stopListening`, chamado com a escuta ainda
     * ativa). As três são "a pessoa acabou de falar", não um cancelamento:
     * o par nativo (`recognition.onend`) já sempre processou o que tinha
     * até ao `stop()`, e ficar a meio aqui deixava o `onEnd` por chamar —
     * o modo do núcleo ficava preso em "a ouvir" para sempre.
     */

    if (chunks.length === 0) {
      callbacks.onError?.('no-speech');
      callbacks.onEnd?.();
      return;
    }

    try {
      const forma = new FormData();
      forma.append('ficheiro', new Blob(chunks, { type: mimeType ?? 'audio/webm' }), 'gravacao.webm');

      const resposta = await fetch(`${CLONE_SERVICE_URL}/ouvir`, { method: 'POST', body: forma });
      if (!resposta.ok) throw new Error(`o serviço local devolveu ${resposta.status}`);

      const corpo = (await resposta.json()) as { texto?: string };
      const texto = (corpo.texto ?? '').trim();

      if (texto) callbacks.onTranscript(texto);
      else callbacks.onError?.('no-speech');
    } catch {
      callbacks.onError?.('local-service-unavailable');
    } finally {
      callbacks.onEnd?.();
    }
  }

  stopListening(): void {
    this.listening = false;

    if (this.hangTimer !== null) {
      clearTimeout(this.hangTimer);
      this.hangTimer = null;
    }

    try {
      this.recognition?.stop();
    } catch {
      /* já parado */
    }
    this.recognition = null;

    if (this.localRecorder && this.localRecorder.state !== 'inactive') {
      this.localRecorder.stop();
    }
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

  /**
   * Grava uns segundos da voz de quem usa o sistema e manda ao serviço
   * local (`POST /voz`) — a gravação que a Parte 7.1 §Voz clonada local
   * pedia por ficheiro à mão (sub-fase 4.2), agora dentro da própria
   * interface. Mesma técnica de `startListeningLocal`, para outro fim: ali
   * é reconhecimento, aqui é a amostra a clonar.
   *
   * Para mais cedo do que `maxDurationMs` se `stop()` for chamado — quem
   * grava não devia ter de esperar o limite todo só porque já disse o que
   * queria.
   */
  recordVoiceSample(maxDurationMs = 12_000): RecordSampleHandle {
    let pararCedo: (() => void) | null = null;

    const result = (async (): Promise<RecordSampleResult> => {
      if (!hasLocalRecordingSupport()) return { ok: false, motivo: 'sem-suporte' };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        const nome = error instanceof Error ? error.name : '';
        return { ok: false, motivo: nome === 'NotAllowedError' ? 'not-allowed' : 'audio-capture' };
      }

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((tipo) =>
        MediaRecorder.isTypeSupported(tipo),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event): void => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const parado = new Promise<void>((resolve) => {
        recorder.onstop = (): void => resolve();
      });

      recorder.start();

      await new Promise<void>((resolve) => {
        const limite = setTimeout(resolve, maxDurationMs);
        pararCedo = (): void => {
          clearTimeout(limite);
          resolve();
        };
      });

      if (recorder.state !== 'inactive') recorder.stop();
      await parado;
      stream.getTracks().forEach((track) => track.stop());

      if (chunks.length === 0) return { ok: false, motivo: 'sem-audio' };

      try {
        const forma = new FormData();
        forma.append('ficheiro', new Blob(chunks, { type: mimeType ?? 'audio/webm' }), 'referencia.webm');

        const resposta = await fetch(`${CLONE_SERVICE_URL}/voz`, { method: 'POST', body: forma });
        if (!resposta.ok) {
          const corpo = (await resposta.json().catch(() => null)) as { detail?: string } | null;
          return { ok: false, motivo: corpo?.detail ?? `o serviço local devolveu ${resposta.status}` };
        }

        const corpo = (await resposta.json()) as { bytes?: number };
        return { ok: true, bytes: corpo.bytes ?? 0 };
      } catch {
        return { ok: false, motivo: 'local-service-unavailable' };
      }
    })();

    return {
      result,
      stop: (): void => pararCedo?.(),
    };
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
