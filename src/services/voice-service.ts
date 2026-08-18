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

/**
 * Quanto mais depressa a voz clonada lê. `1.0` é o ritmo de base do XTTS-v2,
 * que sai deliberado de mais para conversa — um valor acima acelera sem
 * distorcer (o modelo ajusta o comprimento, não o tom). Achado ao vivo
 * (14/08/2026): a leitura "muito lenta, com pausas" era isto a acumular-se à
 * latência da síntese frase a frase.
 */
const VELOCIDADE_FALA = 1.12;

/**
 * O tempo mínimo entre dois reinícios do serviço local de voz. Um reinício
 * demora (é preciso carregar o XTTS-v2 outra vez), e uma falha de síntese que
 * não seja culpa do serviço (um texto que o modelo não sabe ler) não pode
 * disparar um ciclo de reinícios atrás do outro.
 */
const RESTART_COOLDOWN_MS = 60_000;

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
  const silencioMs = opcoes.silencioMs ?? 2_000;
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

/**
 * Limpa o texto antes de sintetizar — pontuação que fica lida à letra em
 * vez de servir só de pausa.
 *
 * Confirmado a sério, não só por ler o código: um texto curto isolado como
 * "Bom dia." (a primeira frase de `BOOT_SPOKEN_LINE`, testada à parte) sai
 * do XTTS-v2 como "Bom dia. Ponto." em cerca de 1 em cada 4 gerações — um
 * sintoma conhecido de modelos de síntese neuronais com pouco texto: sem
 * contexto a seguir, o modelo por vezes lê o ponto final em vez de o tratar
 * como fim de frase. A mesma frase completa (`BOOT_SPOKEN_LINE` inteira,
 * com mais texto a seguir ao primeiro ponto) nunca reproduziu o problema —
 * por isso o ponto **final** é que se tira, não os pontos a meio de uma
 * frase mais longa, que servem de pausa real entre orações.
 *
 * **Ponto e vírgula (13/08/2026)**: reportado em uso real — nunca tinha sido
 * tratado, ao contrário do ponto final e das reticências. Mesma correção:
 * vira vírgula, não desaparece, porque a pausa entre as duas orações
 * continua a fazer sentido.
 *
 * Aplica-se antes de escolher a voz (clonada ou do sistema): o ponto final
 * é redundante para as duas — o fim da string já diz que a frase acabou —
 * e é a voz clonada que, por vezes, o lê à letra.
 */
function limparParaSintese(texto: string): string {
  return (
    texto
      // Reticências (três pontos ou o carácter único "…") só servem de
      // pausa — viram vírgula, que já pausa a prosódia sem arriscar ser lida.
      .replace(/\.{3,}|…/g, ',')
      // Ponto e vírgula tem o mesmo problema do ponto final — por vezes sai
      // lido à letra ("ponto e vírgula") em vez de servir só de pausa entre
      // orações. Vira vírgula, pela mesma razão das reticências: mantém a
      // pausa na prosódia sem arriscar ser lido.
      .replace(/;/g, ',')
      // O ponto — final ou a meio de uma resposta com várias frases num só
      // `speak` — é o que, por vezes, sai como a palavra "ponto". Viram todos
      // vírgula: a vírgula pausa a prosódia sem arriscar ser lida à letra.
      .replace(/\./g, ',')
      // Uma vírgula no fim não faz pausa nenhuma — tira-se.
      .replace(/,+\s*$/, '')
      .trim()
  );
}

export interface VoiceCallbacks {
  readonly onTranscript: (text: string) => void;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
  /** O código que o navegador deu, quando há um — nunca inventado. */
  readonly onError?: (kind: SpeechRecognitionErrorKind | null) => void;
}

/**
 * Quanto tempo, depois de a voz parar de tocar, o microfone continua
 * bloqueado — o eco não desaparece no instante exato em que o áudio
 * termina (a sala continua a ressoar, e o `AnalyserNode` do
 * `vigiarSilencio` continua a ouvir isso por mais uns instantes).
 */
const SPEAK_GUARD_MS = 900;

export class VoiceService {
  private recognition: SpeechRecognitionLike | null = null;
  private listening = false;

  /** O relógio de segurança do WebView2 — ver `startListeningNative`. */
  private hangTimer: ReturnType<typeof setTimeout> | null = null;

  /** A gravação em curso para o reconhecimento local, se houver. */
  private localRecorder: MediaRecorder | null = null;

  /**
   * `true` enquanto `speak()`/`speakClonada()` está mesmo a tocar áudio —
   * não enquanto só se está a pedir o áudio ao serviço local.
   *
   * Existe para o microfone nunca se ligar a ouvir a própria voz do
   * sistema pelas colunas como se fosse um pedido novo (Parte 7.2 §Voz):
   * sem isto, um "Bom dia" dito em voz alta podia ser ouvido de volta pelo
   * microfone, transcrito, respondido, e o ciclo não tinha razão nenhuma
   * para parar sozinho.
   */
  private speaking = false;

  /** Até quando o microfone continua bloqueado, depois de a voz parar — ver `SPEAK_GUARD_MS`. */
  private speakGuardUntil = 0;

  /** `true` enquanto se estiver a falar, ou durante o período de segurança logo a seguir. */
  private get isSpeakingOrGuarded(): boolean {
    return this.speaking || Date.now() < this.speakGuardUntil;
  }

  /** `true` enquanto a voz estiver mesmo a tocar — sem o período de guarda. */
  get isSpeaking(): boolean {
    return this.speaking;
  }

  /**
   * Modo conversa (Parte 7.2 §Modos de escuta): o microfone liga-se
   * automaticamente após cada resposta, em vez de voltar a `idle`.
   *
   * Desligar o modo conversa também para a escuta atual — o utilizador
   * pediu para parar, não faz sentido continuar a ouvir.
   */
  private conversationMode = false;

  /** Conta tentativas seguidas sem fala detetada, para desligar sozinho. */
  private consecutiveNoSpeech = 0;

  get isConversationMode(): boolean {
    return this.conversationMode;
  }

  setConversationMode(enabled: boolean): void {
    this.conversationMode = enabled;
    this.consecutiveNoSpeech = 0;
    if (!enabled) this.stopListening();
  }

  get consecutiveNoSpeechCount(): number {
    return this.consecutiveNoSpeech;
  }

  incrementNoSpeech(): void {
    this.consecutiveNoSpeech += 1;
  }

  resetNoSpeech(): void {
    this.consecutiveNoSpeech = 0;
  }

  private onSpeechStart(): void {
    this.speaking = true;
  }

  private onSpeechEnd(): void {
    this.speaking = false;
    this.speakGuardUntil = Date.now() + SPEAK_GUARD_MS;
  }

  get isRecognitionSupported(): boolean {
    return getRecognitionConstructor() !== null || hasLocalRecordingSupport();
  }

  get isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get isListening(): boolean {
    return this.listening;
  }

  /**
   * Liga ou desliga a escuta. Devolve o estado resultante.
   *
   * Nunca liga enquanto o sistema estiver a falar, nem durante o período
   * de segurança logo a seguir (`SPEAK_GUARD_MS`) — o eco acústico da
   * própria voz do JARVIS, ouvido pelo microfone como se fosse um pedido
   * novo, é o caso a sério que isto evita (Parte 7.2 §Voz).
   */
  toggleListening(callbacks: VoiceCallbacks): boolean {
    if (this.listening) {
      this.stopListening();
      return false;
    }

    if (this.isSpeakingOrGuarded) {
      callbacks.onError?.('a-falar');
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
   * Liga a escuta já, interrompendo a fala se estiver a decorrer.
   *
   * É o caminho do microfone manual: quem carrega no botão quis falar por
   * cima da resposta, e o guard de eco (`'a-falar'`) é só para o re-engate
   * automático do modo conversa — uma pessoa nunca devia receber esse erro,
   * nem ter de esperar a resposta acabar para ser ouvida.
   *
   * A escuta marca-se ANTES de `stopSpeaking()`: parar a fala dispara o
   * `onEnd` de quem a pediu, e esse `onEnd` (no modo conversa) re-engataria o
   * microfone se o visse ainda desligado. Marcar primeiro fecha essa porta.
   */
  bargeIn(callbacks: VoiceCallbacks): boolean {
    if (this.listening) {
      this.stopListening();
      return false;
    }

    this.listening = true;
    if (this.speaking) this.stopSpeaking();
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
    }, 20_000);

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

      // Timeout de 30s: o Whisper pode demorar com áudio mais longo, mas não
      // deve bloquear a interface para sempre — sem isto, um fetch pendurado
      // deixava o núcleo preso em "a ouvir" sem pista nenhuma de porquê.
      const resposta = await fetch(`${CLONE_SERVICE_URL}/ouvir`, {
        method: 'POST',
        body: forma,
        signal: AbortSignal.timeout(30_000),
      });
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

  /**
   * O áudio da voz clonada atualmente a tocar, e a sua URL.
   *
   * A URL fica guardada para se poder revogar a qualquer momento — o
   * `pause()` não dispara `onended`, e sem isto a blob URL sobrevivia até
   * a página ser fechada.
   */
  private cloneAudio: { readonly audio: HTMLAudioElement; readonly url: string } | null = null;

  /**
   * Contador que cresce a cada `speak()` (e a cada `stopSpeaking()`) —
   * uma `speakClonada` em voo verifica se o seu número ainda é o atual
   * antes de começar a tocar, e descarta-se se não for.
   */
  private speakGeneration = 0;

  /**
   * O `onEnd` da fala em curso, embrulhado por `speak()` para disparar
   * exatamente uma vez. Guardado aqui para `stopSpeaking()` o poder
   * disparar também quando a fala é cortada a meio — o `pause()` do áudio
   * clonado nunca dispara `onended`, e o `cancel()` da síntese nem sempre
   * dispara nada. Ver `speak()`.
   */
  private activeSpeechEnd: (() => void) | null = null;

  /**
   * Pré-síntese da frase seguinte (Parte 7.1 §Voz): enquanto uma frase
   * clonada toca, a frase que já está na fila é sintetizada em paralelo, para
   * o `speakClonada` seguinte a achar pronta em vez de pagar a latência do
   * `/falar` (5–9 s) outra vez — é essa latência, somada frase a frase, que o
   * utilizador ouvia como "pausas" entre frases.
   */
  private prefetchProntas = new Map<string, string>();

  /** Frases com um `/falar` em voo, para não pedir a mesma duas vezes. */
  private prefetchEmVoo = new Set<string>();

  /** Avança a cada `stopSpeaking`/`setSelection` para invalidar pré-sínteses em voo. */
  private prefetchGeracao = 0;

  setSelection(selection: VoiceSelection): void {
    this.selection = selection;
    // Voz nova → pré-sínteses feitas para a voz antiga já não servem.
    this.prefetchGeracao += 1;
    this.descartarPrefetch();
  }

  /** Pede áudio ao serviço local; devolve a URL, ou `null` se falhou. */
  private async fetchCloneUrl(text: string, nome: string | null): Promise<string | null> {
    try {
      const resposta = await fetch(`${CLONE_SERVICE_URL}/falar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: text,
          velocidade: VELOCIDADE_FALA,
          ...(nome ? { voz: nome } : {}),
        }),
      });
      if (!resposta.ok) throw new Error(`o serviço local devolveu ${resposta.status}`);
      return URL.createObjectURL(await resposta.blob());
    } catch {
      // O serviço pode estar em baixo (erro de rede) OU "a correr mas
      // partido" (o contexto CUDA envenenado devolve 500 a todas as sínteses,
      // apesar de `/health` continuar a responder). Nos dois casos pede-se o
      // reinício — a frase atual cai para a voz do sistema, e a frase
      // seguinte já apanha o serviço com um contexto CUDA fresco.
      this.pedirReinicioDoServico();
      return null;
    }
  }

  /**
   * Pré-sintetiza `text` se a voz clonada for a escolhida. No-op para a voz
   * do sistema (que não tem latência de rede para esconder) e para pedidos
   * repetidos da mesma frase.
   */
  prefetchClonada(text: string): void {
    const selection = this.selection;
    if (selection.kind !== 'clonada') return;

    // A chave tem de ser o texto *limpo* — é esse que `speak()` passa a
    // `speakClonada` (a frase crua ainda traz o ponto final, e a limpeza
    // tira-o). Guardar sob a frase crua nunca ia bater com o `speak`.
    const limpo = limparParaSintese(text);
    if (limpo.length === 0) return;
    if (this.prefetchProntas.has(limpo) || this.prefetchEmVoo.has(limpo)) return;

    const nome = selection.nome;
    const geracao = this.prefetchGeracao;
    this.prefetchEmVoo.add(limpo);

    void this.fetchCloneUrl(limpo, nome).then((url) => {
      this.prefetchEmVoo.delete(limpo);
      if (url === null) return;
      // Uma interrupção entretanto (stopSpeaking/setSelection) invalida a
      // pré-síntese — revoga-se a URL em vez de a deixar órfã.
      if (geracao !== this.prefetchGeracao) {
        URL.revokeObjectURL(url);
        return;
      }
      this.prefetchProntas.set(limpo, url);
    });
  }

  /** Revoga e esvazia tudo o que a pré-síntese tenha em curso ou pronto. */
  private descartarPrefetch(): void {
    for (const url of this.prefetchProntas.values()) URL.revokeObjectURL(url);
    this.prefetchProntas.clear();
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

  /**
   * Fala pelo serviço local de voz clonada. `nome: null` é a voz gravada do
   * utilizador.
   *
   * Aceita a geração em que foi chamada (`toque`): se já não for a geração
   * atual do serviço, descarta o áudio depois do `fetch` — sem isto, duas
   * chamadas rápidas podem tocar a resposta errada, e `stopSpeaking` a meio
   * do pedido não impede o áudio de soar na mesma.
   */
  private async speakClonada(
    text: string,
    nome: string | null,
    toque: number,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
  ): Promise<void> {
    try {
      // Pré-síntese pronta (ver `prefetchClonada`)? Usa-se, sem pagar a
      // latência do `/falar`. A frase sai do mapa na mesma — é de uma fala só.
      const prefetched = this.prefetchProntas.get(text);
      this.prefetchProntas.delete(text);

      const url = prefetched !== undefined ? prefetched : await this.fetchCloneUrl(text, nome);
      if (url === null) throw new Error('o serviço de voz local devolveu erro');

      // Se a geração já não é a atual, o áudio perdeu a vez — descarta-se
      // antes de criar o Audio sequer.
      if (toque !== this.speakGeneration) {
        URL.revokeObjectURL(url);
        return;
      }

      // Limpa o áudio anterior, e a URL que ele segurava — o `onended`
      // nunca dispara em `pause()`, e sem revogar aqui a blob URL fugia.
      if (this.cloneAudio) {
        this.cloneAudio.audio.pause();
        URL.revokeObjectURL(this.cloneAudio.url);
        this.cloneAudio = null;
      }

      // Segunda verificação: entre a linha acima e aqui, outra `speakClonada`
      // pode ter sido despachada. Sem esta verificação, duas chamadas
      // simultâneas que cheguem a esta linha ao mesmo tempo sobrescrevem-se
      // sem a primeira se limpar.
      if (toque !== this.speakGeneration) {
        URL.revokeObjectURL(url);
        return;
      }

      const audio = new Audio(url);
      this.cloneAudio = { audio, url };

      const limpar = (): void => {
        URL.revokeObjectURL(url);
        if (this.cloneAudio?.audio === audio) this.cloneAudio = null;
      };

      audio.onplay = () => {
        this.onSpeechStart();
        callbacks?.onStart?.();
      };
      audio.onended = () => {
        this.onSpeechEnd();
        limpar();
        callbacks?.onEnd?.();
      };
      audio.onerror = () => {
        this.onSpeechEnd();
        limpar();
        callbacks?.onEnd?.();
      };

      await audio.play();
    } catch {
      // O serviço local pode não estar a correr, OU o `audio.play()` pode
      // recusar (política de autoplay). Num caso e no outro, se ainda há um
      // áudio anterior a tocar, para-se e revoga-se a sua URL: sem isto, uma
      // fala antiga continuava a soar já sem o microfone guardado (a
      // `onSpeechEnd` abaixo liberta-o), e no caso do `play()` recusado a
      // blob URL criada ficava órfã até à página fechar — o mesmo defeito
      // que a variável `cloneAudio` existe para evitar.
      if (this.cloneAudio) {
        this.cloneAudio.audio.pause();
        URL.revokeObjectURL(this.cloneAudio.url);
        this.cloneAudio = null;
      }

      // Se a geração já não é a atual, esta fala perdeu a vez enquanto
      // falhava — não vale a pena avisar nem cair para a voz do sistema por
      // uma resposta que já ninguém espera.
      if (toque !== this.speakGeneration) {
        this.onSpeechEnd();
        callbacks?.onEnd?.();
        return;
      }

      // **Cair para a voz do sistema em vez de ficar mudo.** Achado ao vivo
      // (14/08/2026): com uma voz clonada escolhida e o serviço local
      // desligado, o assistente ficava silencioso — sem som, sem erro, sem
      // pista nenhuma. O serviço local é um processo à parte
      // (`voice-clone-service/run.ps1`); esquecer de o arrancar não pode
      // significar um assistente mudo. A voz do sistema é pior, mas ouve-se.
      this.cloneUnavailable = true;
      this.onCloneServiceUnavailable?.();

      if (this.speakSistema(text, callbacks)) return;

      // Nem o sistema arrancou (sem suporte nenhum): liberta o microfone —
      // `speak()` já o tinha marcado como "a falar", e sem isto ficava
      // bloqueado à espera de um `onend` que nunca chega.
      this.onSpeechEnd();
      callbacks?.onEnd?.();
    }
  }

  /**
   * `true` depois de uma tentativa de voz clonada falhar por o serviço local
   * não responder. A UI lê isto para explicar o silêncio — ver
   * `onCloneServiceUnavailable`.
   */
  private cloneUnavailable = false;

  get isCloneServiceUnavailable(): boolean {
    return this.cloneUnavailable;
  }

  /**
   * Avisado uma vez, quando a voz clonada falha e se cai para a do sistema.
   *
   * Um callback em vez de uma importação do `notificationService`: este
   * ficheiro não importa nada de propósito (é um serviço de fronteira com o
   * browser), e quem o liga à interface é o `useVoice`.
   */
  onCloneServiceUnavailable: (() => void) | null = null;

  /**
   * Reinício do serviço local, pedido de propósito quando a síntese falha.
   *
   * Outro callback em vez de uma importação, pela mesma razão do
   * `onCloneServiceUnavailable` acima: este ficheiro não importa nada de
   * propósito (é um serviço de fronteira com o browser), e quem o liga ao
   * `PlatformAdapter` (que fala com o Rust) é o `useVoice`.
   */
  onCloneServiceNeedsRestart: (() => void) | null = null;

  /** Quando foi pedido o último reinício — ver `RESTART_COOLDOWN_MS`. */
  private lastRestartAttempt = 0;

  private pedirReinicioDoServico(): void {
    if (this.onCloneServiceNeedsRestart === null) return;

    const agora = Date.now();
    if (agora - this.lastRestartAttempt < RESTART_COOLDOWN_MS) return;
    this.lastRestartAttempt = agora;

    // Fogo e esquecimento: o reinício demora (recarregar o modelo), e a fala
    // atual já caiu para a voz do sistema — não vale a pena esperar por ele.
    void this.onCloneServiceNeedsRestart();
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
   *
   * O microfone fica bloqueado já a partir daqui, antes de se pedir o
   * áudio ao serviço local — não só quando ele começa mesmo a tocar. A voz
   * clonada demora a gerar (pedido de rede + síntese), e sem marcar já
   * aqui havia uma janela, enquanto se espera pelo áudio, em que o
   * microfone continuava livre para ligar por cima.
   */
  speak(
    text: string,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    selectionOverride?: VoiceSelection,
  ): boolean {
    const selection = selectionOverride ?? this.selection;
    const limpo = limparParaSintese(text);

    this.onSpeechStart();
    const toque = ++this.speakGeneration;

    // O `onEnd` do chamador tem de disparar exatamente uma vez, aconteça o
    // que acontecer — a fala acabar sozinha (`onend`/`onerror`), o serviço
    // local falhar, ou a fala ser cortada a meio por `stopSpeaking`. O
    // `pause()` do áudio clonado nunca dispara `onended`, e o `cancel()` da
    // síntese nem sempre dispara nada — sem este embrulho, quem usa `onEnd`
    // para mudar de estado (o núcleo do assistente) ficava preso em
    // "a falar" para sempre. Idempotente de propósito: um motor que dispare
    // `onend` *e* `onerror` pela mesma fala não duplica o `onEnd`.
    let acabou = false;
    const terminar = (): void => {
      if (acabou) return;
      acabou = true;
      callbacks?.onEnd?.();
    };
    this.activeSpeechEnd = terminar;

    // `speakClonada`/`speakSistema` recebem o `onEnd` embrulhado, mas o
    // `onStart` original. Construir o objeto à mão (em vez de espalhar) é o
    // que mantém o `exactOptionalPropertyTypes` feliz: `onStart` só entra
    // quando existe de facto.
    const embrulhado: { onStart?: () => void; onEnd: () => void } = { onEnd: terminar };
    if (callbacks?.onStart) embrulhado.onStart = callbacks.onStart;

    if (selection.kind === 'clonada') {
      void this.speakClonada(limpo, selection.nome, toque, embrulhado);
      return true;
    }

    const arrancou = this.speakSistema(
      limpo,
      embrulhado,
      selection.kind === 'sistema' ? selection.voiceURI : undefined,
    );
    // Não arrancou (sem suporte, ou o construtor rebentou): não vem nenhum
    // `onend` a libertar o microfone, nem a disparar o `onEnd`. Liberta-se
    // o microfone já aqui, e limpa-se o `activeSpeechEnd` para um
    // `stopSpeaking` futuro não disparar um `onEnd` por uma fala que nunca
    // chegou a começar.
    if (!arrancou) {
      this.activeSpeechEnd = null;
      this.onSpeechEnd();
    }
    return arrancou;
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

      utterance.onstart = (): void => {
        this.onSpeechStart();
        callbacks?.onStart?.();
      };
      utterance.onend = (): void => {
        this.onSpeechEnd();
        callbacks?.onEnd?.();
      };
      utterance.onerror = (): void => {
        this.onSpeechEnd();
        callbacks?.onEnd?.();
      };

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

    // Avançar a geração faz com que qualquer `speakClonada` que esteja em
    // voo (a meio do `fetch`) se descarte em vez de tocar — o utilizador
    // pediu para parar, e o áudio que chegar depois já não lhe pertence.
    this.speakGeneration += 1;

    // O mesmo para a pré-síntese: as frases que ainda estavam a ser
    // sintetizadas para a fala que acabou de ser cortada já não fazem falta.
    this.prefetchGeracao += 1;
    this.descartarPrefetch();

    if (this.cloneAudio) {
      this.cloneAudio.audio.pause();
      URL.revokeObjectURL(this.cloneAudio.url);
      this.cloneAudio = null;
    }

    // `cancel()`/`pause()` nem sempre disparam `onend`/`onerror` — sem
    // isto, interromper a voz a meio podia deixar o microfone bloqueado
    // para sempre, à espera de um fim que já não vem.
    this.onSpeechEnd();

    // O `onEnd` do chamador também tem de disparar: `onSpeechEnd` liberta
    // o microfone, mas quem usa `onEnd` para mudar de estado (o núcleo do
    // assistente) ficava preso em "a falar" para sempre. O embrulho de
    // `speak()` garante que dispara uma única vez, mesmo que o `cancel()`
    // acima já tenha disparado o `onend` da fala cortada.
    this.activeSpeechEnd?.();
    this.activeSpeechEnd = null;
  }
}

export const voiceService = new VoiceService();
