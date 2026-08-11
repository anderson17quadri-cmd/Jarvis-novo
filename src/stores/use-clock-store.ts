import { create } from 'zustand';

import { clockService } from '@/services/clock-service';

interface ClockState {
  readonly now: Date;
  /**
   * Liga a store ao serviço. Devolve a função de cancelamento — chamá-la
   * desliga a subscrição e pára o temporizador se não houver mais ninguém
   * à escuta.
   */
  readonly hydrate: () => () => void;
  /** Suspende o temporizador sem perder os subscritores. */
  readonly setPaused: (paused: boolean) => void;
}

export const useClockStore = create<ClockState>((set) => ({
  now: new Date(),

  hydrate: () => {
    return clockService.subscribe((now) => set({ now }));
  },

  setPaused: (paused) => {
    clockService.setPaused(paused);
  },
}));
