import type { PlaybackState, Track } from '@/types/music';

/**
 * Contrato de um provedor de música.
 *
 * **Não reproduz áudio.** Modela o estado de reprodução; ligar o Spotify ou um
 * leitor local é implementar isto. Ver `SPEC.md` §Estado de verificação.
 */
export interface MusicProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getState(): Promise<PlaybackState>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionSec: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  toggleShuffle(): Promise<void>;
  toggleRepeat(): Promise<void>;
}

const QUEUE: readonly Track[] = [
  {
    id: 't1',
    title: 'Sinal de Origem',
    artist: 'Núcleo',
    album: 'Project ARC',
    durationSec: 214,
    artwork: ['#00CFFF', '#0A3A5C'],
  },
  {
    id: 't2',
    title: 'Órbita Baixa',
    artist: 'Núcleo',
    album: 'Project ARC',
    durationSec: 187,
    artwork: ['#22E5A0', '#0A3D2E'],
  },
  {
    id: 't3',
    title: 'Silêncio Analítico',
    artist: 'Vetor',
    album: 'Camadas',
    durationSec: 256,
    artwork: ['#FFB020', '#4A2E05'],
  },
  {
    id: 't4',
    title: 'Retorno',
    artist: 'Vetor',
    album: 'Camadas',
    durationSec: 172,
    artwork: ['#B8C4CE', '#2B3138'],
  },
];

/**
 * Provedor simulado.
 *
 * O tempo avança de verdade enquanto está "a tocar" — a barra de progresso
 * move-se e a faixa passa à seguinte ao fim. Sem isso não se veria se os
 * cálculos de posição e de mudança de faixa estão certos.
 */
export class MockMusicProvider implements MusicProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  private index = 0;
  private status: PlaybackState['status'] = 'paused';
  private positionSec = 0;
  private volume = 0.7;
  private shuffle = false;
  private repeat = false;
  /** Instante em que começou a tocar, para calcular a posição real. */
  private startedAt: number | null = null;

  isConfigured(): boolean {
    return true;
  }

  async getState(): Promise<PlaybackState> {
    const track = QUEUE[this.index] ?? null;
    this.advanceClock(track);

    return {
      track,
      status: this.status,
      positionSec: Math.round(this.positionSec),
      volume: this.volume,
      isShuffle: this.shuffle,
      isRepeat: this.repeat,
      queueLength: QUEUE.length,
      queueIndex: this.index,
      isSimulated: true,
    };
  }

  /** Faz a posição acompanhar o tempo decorrido desde o último `play`. */
  private advanceClock(track: Track | null): void {
    if (this.status !== 'playing' || this.startedAt === null || !track) return;

    const elapsed = (Date.now() - this.startedAt) / 1000;
    const position = this.positionSec + elapsed;
    this.startedAt = Date.now();

    if (position < track.durationSec) {
      this.positionSec = position;
      return;
    }

    // Chegou ao fim: repete ou passa à seguinte.
    if (this.repeat) {
      this.positionSec = 0;
      return;
    }

    this.positionSec = 0;
    this.index = (this.index + 1) % QUEUE.length;
  }

  async play(): Promise<void> {
    this.status = 'playing';
    this.startedAt = Date.now();
  }

  async pause(): Promise<void> {
    // Consolidar a posição antes de parar o relógio, senão perdia-se.
    await this.getState();
    this.status = 'paused';
    this.startedAt = null;
  }

  async next(): Promise<void> {
    this.index = this.shuffle
      ? Math.floor(Math.random() * QUEUE.length)
      : (this.index + 1) % QUEUE.length;
    this.positionSec = 0;
    this.startedAt = this.status === 'playing' ? Date.now() : null;
  }

  async previous(): Promise<void> {
    // Convenção comum: só volta atrás nos primeiros segundos.
    if (this.positionSec > 3) {
      this.positionSec = 0;
    } else {
      this.index = (this.index - 1 + QUEUE.length) % QUEUE.length;
      this.positionSec = 0;
    }
    this.startedAt = this.status === 'playing' ? Date.now() : null;
  }

  async seek(positionSec: number): Promise<void> {
    const track = QUEUE[this.index];
    this.positionSec = Math.max(0, Math.min(track?.durationSec ?? 0, positionSec));
    this.startedAt = this.status === 'playing' ? Date.now() : null;
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  async toggleShuffle(): Promise<void> {
    this.shuffle = !this.shuffle;
  }

  async toggleRepeat(): Promise<void> {
    this.repeat = !this.repeat;
  }
}
