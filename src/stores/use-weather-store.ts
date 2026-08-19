import { create } from 'zustand';

import { weatherService } from '@/services/weather/weather-service';
import type { WeatherSnapshot } from '@/types/weather';

interface WeatherState {
  /** Último snapshot de meteorologia conhecido. `null` até à primeira leitura. */
  readonly snapshot: WeatherSnapshot | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
  /**
   * A última leitura falhou (rede em baixo, chave inválida, etc.) — o widget
   * mostra isto em vez de fingir que os dados continuam frescos. `null`
   * quando a última leitura correu bem.
   */
  readonly error: string | null;
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
  error: null,

  refresh: async () => {
    const snapshot = await weatherService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    // Se já há dados, o estado inicial reflete-os.
    if (get().snapshot === null && weatherService.current !== null) {
      set({ snapshot: weatherService.current, isLoading: false });
    }

    const unsubData = weatherService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
    const unsubError = weatherService.subscribeError((error) => {
      set(error !== null ? { error, isLoading: false } : { error });
    });

    return () => {
      unsubData();
      unsubError();
    };
  },
}));
