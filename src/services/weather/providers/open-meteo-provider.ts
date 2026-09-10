import type { WeatherCondition, WeatherDay, WeatherSnapshot } from '@/types/weather';
import type { WeatherProvider } from './weather-provider';

/**
 * Provedor real de meteorologia — Open-Meteo.
 *
 * Escolheu-se o Open-Meteo em vez do OpenWeatherMap por uma razão de
 * simplicidade e de privacidade: **não precisa de chave nenhuma**. A API é
 * gratuita, sem registo, e os dados vêm de modelos meteorológicos públicos
 * (ECMWF, GFS, etc.). Um provedor com chave obrigaria a guardar mais um
 * segredo no cofre e a explicar na interface para onde ia — sem ganhar nada
 * que a previsão a 7 dias pedida pela Parte 6.2 realmente use. O custo é a
 * localização: em vez de uma coordenada detetada pelo sistema, a pessoa
 * escreve o nome da cidade, que o geocoder do próprio Open-Meteo resolve.
 *
 * Dois pedidos por leitura:
 *  1. geocoding — cidade → latitude/longitude e nome resolvido;
 *  2. forecast — coordenadas → estado atual + previsão a 7 dias.
 *
 * Ambos são `https://…open-meteo.com`, que o CSP da aplicação autoriza (ver
 * `tauri.conf.json` §`connect-src`). Nada disto guarda ou envia segredos: só
 * o nome de uma cidade.
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Campos pedidos na previsão — o mínimo para preencher o `WeatherSnapshot`. */
const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'weather_code',
  'wind_speed_10m',
  'surface_pressure',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'precipitation_probability_max',
].join(',');

interface GeoResult {
  readonly name: string;
  readonly country?: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface GeoResponse {
  readonly results?: readonly GeoResult[];
}

interface ForecastCurrent {
  readonly temperature_2m: number;
  readonly relative_humidity_2m: number;
  readonly apparent_temperature: number;
  readonly weather_code: number;
  readonly wind_speed_10m: number;
  readonly surface_pressure: number;
}

interface ForecastDaily {
  readonly time: readonly string[];
  readonly weather_code: readonly number[];
  readonly temperature_2m_max: readonly number[];
  readonly temperature_2m_min: readonly number[];
  readonly sunrise: readonly string[];
  readonly sunset: readonly string[];
  readonly precipitation_probability_max: readonly number[] | null;
}

interface ForecastResponse {
  readonly current?: ForecastCurrent;
  readonly daily?: ForecastDaily;
}

/** Traduz os códigos WMO do Open-Meteo nas condições da interface. */
export function mapWmoCode(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunderstorm';
  // Códigos raros (poeira, cinzas) caem no "nublado" — melhor do que inventar.
  return 'cloudy';
}

/**
 * A data do Open-Meteo vem em "AAAA-MM-DD" ou "AAAA-MM-DDThh:mm", sempre na
 * hora local do sítio (com `timezone=auto`). `new Date(...)` interpreta-a como
 * hora local da máquina — que, para quem pede o tempo da própria cidade, é a
 * mesma. Milissegundos desde a época Unix, como o tipo pede.
 */
function parseLocalMillis(iso: string): number {
  return new Date(iso).getTime();
}

export class OpenMeteoProvider implements WeatherProvider {
  readonly id = 'open-meteo';
  readonly name = 'Open-Meteo';

  constructor(private readonly location = '') {}

  isConfigured(): boolean {
    return this.location.trim().length > 0;
  }

  async fetch(signal?: AbortSignal): Promise<WeatherSnapshot | null> {
    const geo = await this.resolveLocation(signal);
    if (!geo) return null;

    const forecast = await this.fetchForecast(geo, signal);
    if (!forecast) return null;

    return forecast;
  }

  /** Cidade → coordenadas e nome canónico. `null` quando não há resultado. */
  private async resolveLocation(signal?: AbortSignal): Promise<GeoResult | null> {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set('name', this.location.trim());
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'pt');
    url.searchParams.set('format', 'json');

    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) {
      throw new Error(`o geocoder devolveu ${response.status}`);
    }

    const body = (await response.json()) as GeoResponse;
    return body.results?.[0] ?? null;
  }

  /** Coordenadas → `WeatherSnapshot` com o estado atual e 7 dias. */
  private async fetchForecast(geo: GeoResult, signal?: AbortSignal): Promise<WeatherSnapshot> {
    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude', String(geo.latitude));
    url.searchParams.set('longitude', String(geo.longitude));
    url.searchParams.set('current', CURRENT_FIELDS);
    url.searchParams.set('daily', DAILY_FIELDS);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) {
      throw new Error(`o Open-Meteo devolveu ${response.status}`);
    }

    const body = (await response.json()) as ForecastResponse;
    const current = body.current;
    const daily = body.daily;

    if (!current || !daily) {
      throw new Error('o Open-Meteo respondeu sem os campos de tempo');
    }

    const location = geo.country ? `${geo.name}, ${geo.country}` : geo.name;

    const now: WeatherSnapshot['now'] = {
      condition: mapWmoCode(current.weather_code),
      temperatureC: current.temperature_2m,
      feelsLikeC: current.apparent_temperature,
      humidityPercent: current.relative_humidity_2m,
      windKph: current.wind_speed_10m,
      pressureHpa: current.surface_pressure,
      sunrise: parseLocalMillis(daily.sunrise[0] ?? ''),
      sunset: parseLocalMillis(daily.sunset[0] ?? ''),
    };

    const forecast: readonly WeatherDay[] = daily.time.map((date, index) => ({
      date: parseLocalMillis(date),
      condition: mapWmoCode(daily.weather_code[index] ?? 3),
      minC: daily.temperature_2m_min[index] ?? 0,
      maxC: daily.temperature_2m_max[index] ?? 0,
      precipitationChance: Math.round(daily.precipitation_probability_max?.[index] ?? 0),
    }));

    return {
      location,
      now,
      forecast,
      capturedAt: Date.now(),
      isSimulated: false,
    };
  }
}
