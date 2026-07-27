import { PollingDataService } from '../data-service';
import { MockMusicProvider, type MusicProvider } from './providers/music-provider';
import type { PlaybackState } from '@/types/music';

/** Enquanto toca, a posição precisa de acompanhar o segundo. */
const MUSIC_INTERVAL_MS = 1_000;

/**
 * Reprodução de música.
 *
 * **Não toca áudio na Fase 1** — modela e controla o estado. Ligar o Spotify ou
 * um leitor local é implementar `MusicProvider`, sem tocar no widget.
 */
export class MusicService extends PollingDataService<PlaybackState> {
  constructor(private provider: MusicProvider = new MockMusicProvider()) {
    super({ intervalMs: MUSIC_INTERVAL_MS });
  }

  get providerName(): string {
    return this.provider.name;
  }

  get isSimulated(): boolean {
    return this.current?.isSimulated ?? true;
  }

  setProvider(provider: MusicProvider): void {
    this.provider = provider;
    void this.refresh();
  }

  async togglePlay(): Promise<void> {
    if (this.current?.status === 'playing') await this.provider.pause();
    else await this.provider.play();
    await this.refresh();
  }

  async next(): Promise<void> {
    await this.provider.next();
    await this.refresh();
  }

  async previous(): Promise<void> {
    await this.provider.previous();
    await this.refresh();
  }

  async seek(positionSec: number): Promise<void> {
    await this.provider.seek(positionSec);
    await this.refresh();
  }

  async setVolume(volume: number): Promise<void> {
    await this.provider.setVolume(volume);
    await this.refresh();
  }

  async toggleShuffle(): Promise<void> {
    await this.provider.toggleShuffle();
    await this.refresh();
  }

  async toggleRepeat(): Promise<void> {
    await this.provider.toggleRepeat();
    await this.refresh();
  }

  protected async fetch(): Promise<PlaybackState | null> {
    if (!this.provider.isConfigured()) return null;
    return this.provider.getState();
  }
}

export const musicService = new MusicService();
