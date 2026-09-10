/**
 * Música (Parte 6.2 §Widgets previstos).
 *
 * Modela a reprodução sem reproduzir nada. A Fase 1 não toca áudio: isso
 * exigiria ficheiros locais ou uma integração com o Spotify, ambos fora do que
 * é possível verificar sem PC. Ver `SPEC.md` §Estado de verificação.
 */

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly durationSec: number;
  /**
   * Cores da capa, para a desenhar proceduralmente.
   *
   * Um gradiente em vez de uma imagem: sem rede não há capas, e um retângulo
   * cinzento a dizer "sem imagem" seria pior do que uma capa gerada que
   * identifica a faixa pela cor.
   */
  readonly artwork: readonly [string, string];
}

/**
 * Um ficheiro de áudio real, devolvido pelo comando Rust `music_read_dir`.
 *
 * Ao contrário de `Track`, não tem metadados: o Rust só lista nomes e caminhos
 * — a capa e a duração são construídas na interface a partir daí.
 */
export interface MusicFileEntry {
  readonly name: string;
  readonly path: string;
}

export type PlaybackStatus = 'stopped' | 'playing' | 'paused';

export interface PlaybackState {
  readonly track: Track | null;
  readonly status: PlaybackStatus;
  /** Segundos decorridos da faixa atual. */
  readonly positionSec: number;
  /** 0 a 1. */
  readonly volume: number;
  readonly isShuffle: boolean;
  readonly isRepeat: boolean;
  readonly queueLength: number;
  readonly queueIndex: number;
  readonly isSimulated: boolean;
}
