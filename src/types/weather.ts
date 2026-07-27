/**
 * Meteorologia (Parte 6.2 §Widgets previstos).
 *
 * Os tipos são desenhados para o que um provedor real devolve — Open-Meteo,
 * OpenWeather ou outro — para que ligar um deles não obrigue a mexer no widget.
 */

/** Condições, escolhidas para mapear os códigos WMO que a maioria usa. */
export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export interface WeatherNow {
  readonly condition: WeatherCondition;
  readonly temperatureC: number;
  /** Sensação térmica. */
  readonly feelsLikeC: number;
  readonly humidityPercent: number;
  readonly windKph: number;
  readonly pressureHpa: number;
  /** Milissegundos desde a época Unix. */
  readonly sunrise: number;
  readonly sunset: number;
}

export interface WeatherDay {
  /** Início do dia, em milissegundos desde a época Unix. */
  readonly date: number;
  readonly condition: WeatherCondition;
  readonly minC: number;
  readonly maxC: number;
  readonly precipitationChance: number;
}

export interface WeatherSnapshot {
  readonly location: string;
  readonly now: WeatherNow;
  /** Previsão a 7 dias, como a Parte 6.2 pede. */
  readonly forecast: readonly WeatherDay[];
  readonly capturedAt: number;
  /** `true` quando os dados são simulados — a interface diz--o ao utilizador. */
  readonly isSimulated: boolean;
}

/** Etiqueta legível de cada condição, em pt-PT. */
export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: 'Céu limpo',
  'partly-cloudy': 'Parcialmente nublado',
  cloudy: 'Nublado',
  fog: 'Nevoeiro',
  drizzle: 'Chuvisco',
  rain: 'Chuva',
  snow: 'Neve',
  thunderstorm: 'Trovoada',
};
