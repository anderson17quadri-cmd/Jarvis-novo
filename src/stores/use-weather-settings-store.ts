import { create } from 'zustand';

import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { DEFAULT_WEATHER_SETTINGS, type WeatherSettings } from '@/types/weather-settings';

/**
 * Preferências da meteorologia (Peça 8, lote 2).
 *
 * **Só estado e persistência** — mesmo padrão da `useAiSettingsStore`. A
 * conversão das preferências no provedor em vigor está no hook
 * `useWeatherSettings`, que é quem conhece o `OpenMeteoProvider` e o
 * `weatherService`. Esta store guarda e hidrata, só.
 *
 * Não há cofre aqui: a localização não é um segredo, por isso não finge que é.
 */
interface WeatherSettingsState {
  settings: WeatherSettings;

  setEnabled: (enabled: boolean) => void;
  setLocation: (location: string) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useWeatherSettingsStore = create<WeatherSettingsState>((set, get) => ({
  settings: DEFAULT_WEATHER_SETTINGS,

  setEnabled: (enabled) => {
    const settings = { ...get().settings, enabled };
    set({ settings });

    logService.audit(
      enabled
        ? 'Ligar a meteorologia real (Open-Meteo)'
        : 'Desligar a meteorologia real — voltar ao simulado',
      'executado',
    );
    void get().persist();
  },

  setLocation: (location) => {
    const settings = { ...get().settings, location: location.trim() };
    set({ settings });
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.weatherSettings, get().settings);
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<WeatherSettings> | null>(
      STORAGE_KEYS.weatherSettings,
      null,
    );

    const settings: WeatherSettings = {
      ...DEFAULT_WEATHER_SETTINGS,
      ...saved,
    };

    set({ settings });
  },
}));
