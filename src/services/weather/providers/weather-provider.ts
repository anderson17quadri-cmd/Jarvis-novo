import type { WeatherCondition, WeatherSnapshot } from '@/types/weather';

/**
 * Contrato de um provedor de meteorologia.
 *
 * Mesmo padrão do `AiProvider`: trocar o simulado por Open-Meteo ou OpenWeather
 * é escrever uma classe que cumpra isto e registá-la no serviço. Nenhum
 * componente muda, porque nenhum componente conhece o provedor.
 */
export interface WeatherProvider {
  readonly id: string;
  readonly name: string;
  /** `false` quando falta configuração — uma chave de API, uma localização. */
  isConfigured(): boolean;
  fetch(signal?: AbortSignal): Promise<WeatherSnapshot | null>;
}

/** Ciclo de condições da simulação, para o widget mostrar variedade. */
const CONDITION_CYCLE: readonly WeatherCondition[] = [
  'clear',
  'partly-cloudy',
  'cloudy',
  'rain',
  'partly-cloudy',
  'clear',
  'drizzle',
];

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Provedor simulado — o único ativo enquanto não houver rede.
 *
 * A temperatura segue uma curva diária a sério: mínimo de madrugada, máximo a
 * meio da tarde. Números aleatórios dariam um gráfico que se percebe logo ser
 * falso, e esconderiam erros de formatação na interface.
 */
export class MockWeatherProvider implements WeatherProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  constructor(private readonly location = 'Lisboa') {}

  isConfigured(): boolean {
    return true;
  }

  async fetch(): Promise<WeatherSnapshot> {
    const now = Date.now();
    const hour = new Date(now).getHours();

    const temperature = dailyTemperature(hour);
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);

    return {
      location: this.location,
      now: {
        condition: CONDITION_CYCLE[0] ?? 'clear',
        temperatureC: temperature,
        // A sensação afasta-se da real com vento e humidade.
        feelsLikeC: Math.round((temperature - 1.5) * 10) / 10,
        humidityPercent: 52 + Math.round(Math.sin(hour / 3) * 12),
        windKph: 9 + Math.round(Math.abs(Math.sin(hour / 5)) * 14),
        pressureHpa: 1015,
        sunrise: startOfDay + 7 * HOUR_MS,
        sunset: startOfDay + 20 * HOUR_MS + 30 * 60_000,
      },
      forecast: Array.from({ length: 7 }, (_, index) => {
        const base = dailyTemperature(15) + Math.sin(index * 1.1) * 3;
        return {
          date: startOfDay + index * DAY_MS,
          condition: CONDITION_CYCLE[index % CONDITION_CYCLE.length] ?? 'clear',
          minC: Math.round(base - 6),
          maxC: Math.round(base + 3),
          precipitationChance: Math.max(0, Math.round(Math.sin(index * 1.7) * 45 + 20)),
        };
      }),
      capturedAt: now,
      isSimulated: true,
    };
  }
}

/** Curva diária: mínimo às 5h, máximo às 15h. */
function dailyTemperature(hour: number): number {
  const amplitude = 6;
  const mean = 18;
  const value = mean + amplitude * Math.sin(((hour - 9) / 24) * Math.PI * 2);
  return Math.round(value * 10) / 10;
}
