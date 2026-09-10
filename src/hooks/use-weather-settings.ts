import { useEffect } from 'react';

import { weatherService } from '@/services/weather/weather-service';
import { MockWeatherProvider } from '@/services/weather/providers/weather-provider';
import { OpenMeteoProvider } from '@/services/weather/providers/open-meteo-provider';
import { useWeatherSettingsStore } from '@/stores/use-weather-settings-store';
import type { WeatherSettings } from '@/types/weather-settings';

/**
 * Constrói e liga o provedor de meteorologia descrito pelas preferências.
 *
 * A localização é sempre a que estiver guardada — o provedor simulado também a
 * usa, para que ligar/desligar a rede não mude o nome da cidade no widget.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store.
 */
export function applyWeatherSettings(settings: WeatherSettings): void {
  if (settings.enabled && settings.location.trim().length > 0) {
    weatherService.setProvider(new OpenMeteoProvider(settings.location));
    return;
  }

  // Sem ligação pedida, ou sem cidade para procurar, mantém-se o simulado —
  // nunca rebenta por falta de configuração.
  weatherService.setProvider(new MockWeatherProvider(settings.location || 'Lisboa'));
}

/**
 * Aplica as preferências de meteorologia ao serviço sempre que mudam.
 *
 * Mesma forma do `useAiSettings`: a store guarda e hidrata, este hook converte
 * as preferências no provedor em vigor. Monta-se uma vez, no arranque.
 */
export function useWeatherSettings(): void {
  const settings = useWeatherSettingsStore((state) => state.settings);

  useEffect(() => {
    applyWeatherSettings(settings);
  }, [settings]);
}
