import { useEffect } from 'react';

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSun,
  Droplets,
  Snowflake,
  Sun,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { WidgetError, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useIsVisible } from '@/hooks/use-platform';
import { formatTime } from '@/lib/format';
import { weatherService } from '@/services/weather/weather-service';
import { useWeatherStore } from '@/stores/use-weather-store';
import { WEATHER_LABELS, type WeatherCondition } from '@/types/weather';

/** Um ícone Lucide por condição — nunca emoji, como a Parte 2 exige. */
const CONDITION_ICONS: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  'partly-cloudy': CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  thunderstorm: Zap,
};

const WEEKDAY = new Intl.DateTimeFormat('pt-PT', { weekday: 'short' });

/**
 * Clima (Parte 6.2 §Widgets previstos).
 *
 * Condição, temperatura, sensação, humidade, vento, nascer e pôr do sol, e
 * previsão a 7 dias. Os dados vêm do `WeatherService` — hoje simulados, e o
 * widget diz isso em vez de os apresentar como reais.
 */
export default function WeatherWidget(): React.JSX.Element {
  const snapshot = useWeatherStore((s) => s.snapshot);
  const isLoading = useWeatherStore((s) => s.isLoading);
  const error = useWeatherStore((s) => s.error);
  const refresh = useWeatherStore((s) => s.refresh);
  const isVisible = useIsVisible();

  /** Liga a subscrição ao serviço enquanto o widget está montado. */
  useEffect(() => {
    const unsub = useWeatherStore.getState().hydrate();
    return unsub;
  }, []);

  /** Suspende a sondagem quando a janela vai para segundo plano. */
  useEffect(() => {
    weatherService.setPaused(!isVisible);
  }, [isVisible]);

  if (!snapshot && error) {
    return <WidgetError message="Não consegui obter o clima." onRetry={() => void refresh()} />;
  }
  if (isLoading || !snapshot) return <WidgetSkeleton />;

  const { now, forecast, location } = snapshot;
  const Icon = CONDITION_ICONS[now.condition];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="mono text-[30px] font-light leading-none compact:text-[22px]">
              {Math.round(now.temperatureC)}°
            </span>
            <Icon className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
          </div>
          <div className="mt-1 truncate text-[12px] text-t2">{WEATHER_LABELS[now.condition]}</div>
          <div className="truncate text-[10.5px] text-t3">
            {location} · sensação {Math.round(now.feelsLikeC)}°
          </div>
        </div>

        <dl className="flex flex-shrink-0 flex-col gap-1 text-right text-[10.5px] text-t3">
          <div className="flex items-center justify-end gap-1">
            <Droplets className="h-3 w-3" aria-hidden="true" />
            <span className="mono">{now.humidityPercent}%</span>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Wind className="h-3 w-3" aria-hidden="true" />
            <span className="mono">{Math.round(now.windKph)} km/h</span>
          </div>
          <div className="mono">{now.pressureHpa} hPa</div>
        </dl>
      </div>

      <div className="mt-2 flex flex-shrink-0 justify-between text-[10px] text-t3">
        <span>Nascer {formatTime(new Date(now.sunrise))}</span>
        <span>Pôr {formatTime(new Date(now.sunset))}</span>
      </div>

      {/* Previsão a 7 dias. Encolhe sozinha nos tamanhos pequenos. */}
      <ul className="mt-auto flex min-h-0 gap-1 overflow-x-auto pt-2">
        {forecast.map((day) => {
          const DayIcon = CONDITION_ICONS[day.condition];
          return (
            <li
              key={day.date}
              className="flex min-w-[38px] flex-1 flex-col items-center gap-1 rounded-lg bg-tint/[.03] py-1.5"
            >
              <span className="text-[9.5px] uppercase text-t3">
                {WEEKDAY.format(new Date(day.date)).replace('.', '')}
              </span>
              <DayIcon className="h-3.5 w-3.5 text-t2" aria-hidden="true" />
              <span className="mono text-[10px]">
                {day.maxC}°<span className="text-t3">/{day.minC}°</span>
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-danger">
          Não consegui atualizar — a mostrar os últimos dados.
        </p>
      )}
      {snapshot.isSimulated && (
        <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-t3">Dados simulados</p>
      )}
    </div>
  );
}
