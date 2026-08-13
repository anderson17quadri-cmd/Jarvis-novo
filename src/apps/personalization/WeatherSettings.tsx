import { AlertTriangle } from 'lucide-react';

import { useWeatherSettings } from '@/hooks/use-weather-settings';
import { cn } from '@/lib/cn';
import { useWeatherSettingsStore } from '@/stores/use-weather-settings-store';

/**
 * Provedor de meteorologia (Peça 8, lote 2).
 *
 * Ao contrário da IA, aqui não há chave: o Open-Meteo é gratuito e anónimo.
 * A decisão é só se a meteorologia sai ou não do dispositivo, e qual a cidade.
 * Por omissão está desligado — o simulado continua exatamente como estava para
 * quem não mexer em nada.
 */
export function WeatherSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useWeatherSettings();

  const settings = useWeatherSettingsStore((state) => state.settings);
  const setEnabled = useWeatherSettingsStore((state) => state.setEnabled);
  const setLocation = useWeatherSettingsStore((state) => state.setLocation);

  return (
    <div className="flex flex-col gap-s3">
      <button
        type="button"
        role="switch"
        aria-checked={settings.enabled}
        onClick={() => setEnabled(!settings.enabled)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-input border px-3 py-2 text-left',
          'transition-all duration-hover ease-out',
          settings.enabled
            ? 'border-accent/40 bg-accent/[.06]'
            : 'border-line hover:border-accent/25',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium">Meteorologia real (Open-Meteo)</span>
          <span className="block text-cap leading-relaxed text-t3">
            Liga a previsão a 7 dias de verdade. Desligado, o widget continua a mostrar dados
            simulados, como até agora.
          </span>
        </span>
        <span
          className={cn(
            'relative h-[18px] w-[32px] flex-shrink-0 rounded-full transition-colors duration-hover',
            settings.enabled ? 'bg-accent' : 'bg-tint/40',
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform duration-hover',
              settings.enabled ? 'translate-x-[16px]' : 'translate-x-[2px]',
            )}
          />
        </span>
      </button>

      {settings.enabled && (
        <p
          className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
          role="note"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
          <span>
            O nome da cidade sai deste dispositivo para{' '}
            <b>https://geocoding-api.open-meteo.com</b> e{' '}
            <b>https://api.open-meteo.com</b>. Não há chave nem conta: só a localização, para
            devolver o tempo.
          </span>
        </p>
      )}

      <label className="block">
        <span className="t-label mb-1.5 block">Cidade</span>
        <input
          type="text"
          defaultValue={settings.location}
          onBlur={(event) => setLocation(event.target.value)}
          placeholder="Lisboa"
          aria-label="Cidade da meteorologia"
          className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
        />
        <span className="mt-1.5 block text-cap text-t3">
          O nome tal como o escreveria num mapa. O geocoder do Open-Meteo resolve-o para
          coordenadas; se não encontrar nada, o widget fica sem dados até corrigir.
        </span>
      </label>
    </div>
  );
}
