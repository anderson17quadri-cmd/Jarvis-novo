import { getPlatformAdapter } from '@/platform';
import type { PlaybackState, Track } from '@/types/music';
import type { MusicProvider } from './music-provider';

/**
 * Música local (Peça 8, lote 2).
 *
 * Reproduz os ficheiros de áudio de uma pasta escolhida pela pessoa — o
 * primeiro provedor da música que toca som a sério, em vez de modelar o
 * estado. A pasta é declarada no Rust por `music_set_root` (que alarga o
 * âmbito do protocolo `asset` do Tauri) e listada por `music_read_dir`; cada
 * ficheiro é convertido num URL `asset://localhost/…` com `toLocalMediaUrl` e
 * tocado num elemento `<audio>` real.
 *
 * Sem pasta escolhida, o widget mantém o `MockMusicProvider` de sempre — este
 * provedor só é construído quando há um caminho. Se a pasta desaparecer ou a
 * leitura falhar, degrada em silêncio: devolve "sem faixas", nunca lança.
 */

/** Duas cores de capa derivadas do nome do ficheiro — estáveis e sem rede. */
function artworkFor(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return [`hsl(${hue}, 68%, 52%)`, `hsl(${(hue + 45) % 360}, 62%, 20%)`];
}

/** Título a partir do nome do ficheiro: remove a extensão. */
function titleFor(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export class LocalMusicProvider implements MusicProvider {
  readonly id = 'local';
  readonly name = 'Música local';

  private readonly tracks: Track[] = [];
  private index = 0;
  private status: PlaybackState['status'] = 'stopped';
  private volume = 0.7;
  private shuffle = false;
  private repeat = false;

  private audio: HTMLAudioElement | null = null;
  /** Id da faixa que o `<audio>` tem carregada, para não recarregar à toa. */
  private currentTrackId: string | null = null;
  /** `null` = ainda não tentado; `true`/`false` depois da primeira leitura. */
  private loaded: boolean | null = null;
  private initPromise: Promise<boolean> | null = null;

  constructor(
    private readonly rootPath: string,
    private readonly rootName: string,
  ) {}

  isConfigured(): boolean {
    return this.rootPath.trim().length > 0;
  }

  async getState(): Promise<PlaybackState> {
    const ok = await this.ensureLoaded();
    if (!ok || this.tracks.length === 0) {
      return this.emptyState();
    }

    const track = this.tracks[this.index] ?? null;
    if (!track) return this.emptyState();

    this.syncAudio(track);
    this.refreshDuration(track);

    const audio = this.audio;
    const positionSec = audio ? Math.floor(audio.currentTime) : 0;

    return {
      track,
      status: this.status,
      positionSec,
      volume: this.volume,
      isShuffle: this.shuffle,
      isRepeat: this.repeat,
      queueLength: this.tracks.length,
      queueIndex: this.index,
      isSimulated: false,
    };
  }

  async play(): Promise<void> {
    await this.ensureLoaded();
    const track = this.tracks[this.index] ?? null;
    if (!track) return;

    this.syncAudio(track);
    if (this.audio) {
      try {
        await this.audio.play();
      } catch {
        // Sem dispositivo de áudio ou reprodução bloqueada — não rebenta.
      }
    }
    this.status = 'playing';
  }

  async pause(): Promise<void> {
    if (this.audio) this.audio.pause();
    if (this.status === 'playing') this.status = 'paused';
  }

  async next(): Promise<void> {
    await this.ensureLoaded();
    await this.advance(1);
  }

  async previous(): Promise<void> {
    await this.ensureLoaded();
    if (this.tracks.length === 0) return;

    // Convenção dos leitores: nos primeiros segundos volta à faixa anterior;
    // depois disso recomeça a atual.
    const position = this.audio?.currentTime ?? 0;
    if (position > 3) {
      await this.seek(0);
      return;
    }
    await this.advance(-1);
  }

  async seek(positionSec: number): Promise<void> {
    await this.ensureLoaded();
    if (!this.audio) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.audio.currentTime = Math.max(0, Math.min(duration, positionSec));
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) this.audio.volume = this.volume;
  }

  async toggleShuffle(): Promise<void> {
    this.shuffle = !this.shuffle;
  }

  async toggleRepeat(): Promise<void> {
    this.repeat = !this.repeat;
  }

  /** Lê a pasta uma só vez. `false` se não deu (pasta desapareceu, etc.). */
  private ensureLoaded(): Promise<boolean> {
    if (this.loaded !== null) return Promise.resolve(this.loaded);
    this.initPromise ??= this.load();
    return this.initPromise;
  }

  private async load(): Promise<boolean> {
    try {
      const adapter = getPlatformAdapter();

      // Reafirma a raiz no Rust — o estado gerido não sobrevive a fechar a
      // aplicação, e é aqui que o âmbito do protocolo `asset` se alarga.
      const declared = await adapter.musicSetRoot(this.rootPath);
      if (!declared) {
        this.loaded = false;
        return false;
      }

      const entries = await adapter.musicReadDir();
      this.tracks.length = 0;
      for (const entry of entries) {
        this.tracks.push({
          id: entry.path,
          title: titleFor(entry.name),
          artist: this.rootName,
          album: 'Ficheiro local',
          durationSec: 0,
          artwork: artworkFor(entry.name),
        });
      }

      this.loaded = true;
      return true;
    } catch {
      this.loaded = false;
      return false;
    }
  }

  /** Carrega a faixa atual no `<audio>`, criando-o na primeira vez. */
  private syncAudio(track: Track): void {
    if (this.currentTrackId === track.id && this.audio !== null) return;

    const url = getPlatformAdapter().toLocalMediaUrl(track.id);
    if (this.audio === null) {
      this.audio = new Audio();
      this.audio.volume = this.volume;
      this.audio.onended = () => this.handleEnded();
    }

    this.audio.src = url;
    this.currentTrackId = track.id;
    this.status = 'stopped';
  }

  /** A duração só se sabe depois do `loadedmetadata` — atualiza quando chega. */
  private refreshDuration(track: Track): void {
    const audio = this.audio;
    if (!audio) return;
    const duration = audio.duration;
    if (Number.isFinite(duration) && duration > 0 && track.durationSec !== Math.floor(duration)) {
      this.tracks[this.index] = { ...track, durationSec: Math.floor(duration) };
    }
  }

  private handleEnded(): void {
    if (this.repeat) {
      if (this.audio) {
        this.audio.currentTime = 0;
        void this.audio.play().catch(() => undefined);
      }
      this.status = 'playing';
      return;
    }
    void this.advance(1);
  }

  private async advance(step: number): Promise<void> {
    if (this.tracks.length === 0) return;

    this.index = this.shuffle
      ? Math.floor(Math.random() * this.tracks.length)
      : (this.index + step + this.tracks.length) % this.tracks.length;

    const wasPlaying = this.status === 'playing';
    const track = this.tracks[this.index] ?? null;
    if (track) this.syncAudio(track);
    if (wasPlaying) await this.play();
  }

  private emptyState(): PlaybackState {
    return {
      track: null,
      status: 'stopped',
      positionSec: 0,
      volume: this.volume,
      isShuffle: this.shuffle,
      isRepeat: this.repeat,
      queueLength: this.tracks.length,
      queueIndex: 0,
      isSimulated: false,
    };
  }
}
