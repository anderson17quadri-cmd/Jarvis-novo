import { storageService, STORAGE_KEYS } from './storage-service';

/**
 * Sons do sistema (Parte 9 §Som).
 *
 * **Sintetizados, não gravados.** Cada som é um oscilador com um envelope de
 * poucos milissegundos — nenhum ficheiro de áudio entra no pacote. É por isso
 * que isto não é uma das coisas bloqueadas à espera do PC: a Web Audio API
 * chega, e funciona igual no browser, no desktop e no Android.
 *
 * O contexto só é criado ao primeiro som, e depois do primeiro gesto do
 * utilizador: os browsers recusam áudio antes disso, e criar o contexto no
 * arranque só deixava um `AudioContext` suspenso a ocupar recursos.
 */

export type SoundName =
  | 'click'
  | 'open'
  | 'close'
  | 'notify'
  | 'success'
  | 'error'
  | 'scanner';

interface Tone {
  /** Frequência inicial, em hertz. */
  readonly from: number;
  /** Frequência final — igual a `from` para um tom fixo. */
  readonly to: number;
  readonly durationMs: number;
  readonly type: OscillatorType;
  /** Volume de pico, entre 0 e 1, antes do volume geral. */
  readonly peak: number;
}

/**
 * Receita de cada som.
 *
 * Todos abaixo dos 120 ms e dos 6% de volume: a spec pede sons que nunca
 * competem com música. Um som de interface que se nota é um som a mais.
 */
const TONES: Record<SoundName, readonly Tone[]> = {
  click: [{ from: 880, to: 660, durationMs: 45, type: 'sine', peak: 0.035 }],
  open: [{ from: 520, to: 780, durationMs: 90, type: 'sine', peak: 0.045 }],
  close: [{ from: 780, to: 460, durationMs: 90, type: 'sine', peak: 0.04 }],
  notify: [
    { from: 660, to: 660, durationMs: 70, type: 'sine', peak: 0.05 },
    { from: 990, to: 990, durationMs: 90, type: 'sine', peak: 0.04 },
  ],
  success: [
    { from: 620, to: 620, durationMs: 60, type: 'sine', peak: 0.045 },
    { from: 930, to: 1_240, durationMs: 110, type: 'sine', peak: 0.045 },
  ],
  error: [
    { from: 300, to: 220, durationMs: 120, type: 'triangle', peak: 0.055 },
  ],
  scanner: [{ from: 1_400, to: 400, durationMs: 110, type: 'sawtooth', peak: 0.02 }],
};

/** Intervalo entre os tons de um som composto, em milissegundos. */
const SEQUENCE_GAP_MS = 55;

export class SoundService {
  private context: AudioContext | null = null;
  private enabled = false;
  private volume = 0.5;

  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentVolume(): number {
    return this.volume;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    // Fechar o contexto ao desligar liberta o recurso, e o próximo som cria
    // outro. Deixá-lo aberto e mudo era desperdício silencioso.
    if (!enabled) this.dispose();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Toca um som. Nunca lança.
   *
   * Um browser sem Web Audio, ou um contexto recusado por falta de gesto, não
   * pode partir uma interação — o som é um extra, não o efeito.
   */
  play(name: SoundName): void {
    if (!this.enabled) return;

    try {
      const context = this.ensureContext();
      if (!context) return;

      // Um contexto suspenso volta a si com a primeira interação real.
      if (context.state === 'suspended') void context.resume();

      TONES[name].forEach((tone, index) => {
        this.playTone(context, tone, context.currentTime + (index * SEQUENCE_GAP_MS) / 1_000);
      });
    } catch {
      // Sem som e sem drama.
    }
  }

  async persist(): Promise<void> {
    await storageService.set(STORAGE_KEYS.sound, {
      enabled: this.enabled,
      volume: this.volume,
    });
  }

  async hydrate(): Promise<void> {
    const saved = await storageService.get<{ enabled: boolean; volume: number }>(
      STORAGE_KEYS.sound,
      // Desligado por omissão: um sistema que começa a apitar sem ser pedido
      // é um sistema que se desliga uma vez e nunca mais se liga.
      { enabled: false, volume: 0.5 },
    );

    this.enabled = saved.enabled;
    this.setVolume(saved.volume);
  }

  /** Liberta o contexto. Usado ao desligar o som e nos testes. */
  dispose(): void {
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return null;

    const Constructor = window.AudioContext;
    if (typeof Constructor !== 'function') return null;

    this.context = new Constructor();
    return this.context;
  }

  private playTone(context: AudioContext, tone: Tone, startAt: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const seconds = tone.durationMs / 1_000;
    const peak = tone.peak * this.volume;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.from, startAt);
    if (tone.to !== tone.from) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.to, startAt + seconds);
    }

    /*
     * Envelope curto. Sem o ataque e a queda, cada som começava e acabava com
     * um estalo — o corte abrupto de uma onda é audível como um clique.
     */
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + seconds + 0.02);
  }
}

export const soundService = new SoundService();
