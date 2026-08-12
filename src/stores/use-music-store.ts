import { create } from 'zustand';

import { musicService } from '@/services/music/music-service';
import type { PlaybackState } from '@/types/music';

interface MusicState {
  /** Último estado de reprodução. `null` até à primeira leitura. */
  readonly snapshot: PlaybackState | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
  /** Força uma leitura avulsa. */
  readonly refresh: () => Promise<void>;
  /**
   * Liga a store ao serviço. Devolve a função de cancelamento — chamá-la
   * desliga a subscrição e pára a sondagem se não houver mais ninguém à
   * escuta.
   */
  readonly hydrate: () => () => void;

  readonly togglePlay: () => Promise<void>;
  readonly next: () => Promise<void>;
  readonly previous: () => Promise<void>;
  readonly seek: (positionSec: number) => Promise<void>;
  readonly setVolume: (volume: number) => Promise<void>;
  readonly toggleShuffle: () => Promise<void>;
  readonly toggleRepeat: () => Promise<void>;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  snapshot: musicService.current,
  isLoading: musicService.current === null,

  refresh: async () => {
    const snapshot = await musicService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    if (get().snapshot === null && musicService.current !== null) {
      set({ snapshot: musicService.current, isLoading: false });
    }

    return musicService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
  },

  togglePlay: async () => {
    await musicService.togglePlay();
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },

  next: async () => {
    await musicService.next();
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },

  previous: async () => {
    await musicService.previous();
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },

  seek: async (positionSec) => {
    await musicService.seek(positionSec);
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },

  setVolume: async (volume) => {
    await musicService.setVolume(volume);
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },

  toggleShuffle: async () => {
    await musicService.toggleShuffle();
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },

  toggleRepeat: async () => {
    await musicService.toggleRepeat();
    const snapshot = musicService.current;
    if (snapshot) set({ snapshot });
  },
}));
