import { PollingDataService } from '../data-service';
import { MockWeatherProvider, type WeatherProvider } from './providers/weather-provider';
import type { WeatherSnapshot } from '@/types/weather';

/** A meteorologia muda devagar — de dez em dez minutos chega. */
const WEATHER_INTERVAL_MS = 10 * 60_000;

/**
 * Meteorologia.
 *
 * Trocar de provedor é `weatherService.setProvider(new OpenMeteoProvider(...))`.
 * O widget não muda, porque fala com o serviço e não com o provedor.
 */
export class WeatherService extends PollingDataService<WeatherSnapshot> {
  constructor(private provider: WeatherProvider = new MockWeatherProvider()) {
    super({ intervalMs: WEATHER_INTERVAL_MS });
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** `true` enquanto os dados forem simulados — a interface avisa. */
  get isSimulated(): boolean {
    return this.current?.isSimulated ?? true;
  }

  setProvider(provider: WeatherProvider): void {
    this.provider = provider;
    void this.refresh();
  }

  protected async fetch(): Promise<WeatherSnapshot | null> {
    if (!this.provider.isConfigured()) return null;
    return this.provider.fetch();
  }
}

export const weatherService = new WeatherService();
