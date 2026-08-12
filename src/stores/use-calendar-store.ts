import { create } from 'zustand';

import { calendarService } from '@/services/calendar/calendar-service';
import type { CalendarSnapshot } from '@/types/calendar';

interface CalendarState {
  /** Último snapshot da agenda. `null` até à primeira leitura. */
  readonly snapshot: CalendarSnapshot | null;
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
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  snapshot: calendarService.current,
  isLoading: calendarService.current === null,

  refresh: async () => {
    const snapshot = await calendarService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    if (get().snapshot === null && calendarService.current !== null) {
      set({ snapshot: calendarService.current, isLoading: false });
    }

    return calendarService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
  },
}));
