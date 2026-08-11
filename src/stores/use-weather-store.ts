import { create } from 'zustand';

import { weatherService } from '@/services/weather/weather-service';
import type { WeatherSnapshot } from '@/types/weather';

interface WeatherState {
  /** Último snapshot de meteorologia conhecido. `null` até à primeira leitura. */
  readonly snapshot: WeatherSnapshot | null;
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

export const useWeatherStore = create<WeatherState>((set, get) => ({
  snapshot: weatherService.current,
  isLoading: weatherService.current === null,

  refresh: async () => {
    const snapshot = await weatherService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    // Se já há dados, o estado inicial reflete-os.
    if (get().snapshot === null && weatherService.current !== null) {
      set({ snapshot: weatherService.current, isLoading: false });
    }

    return weatherService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
  },
}));
