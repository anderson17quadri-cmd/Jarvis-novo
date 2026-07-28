import { useClock } from '@/hooks/use-clock';
import { formatLongDate, formatTime } from '@/lib/format';

/**
 * Relógio (Parte 6.2 §Widgets previstos).
 *
 * Hora, data completa e fuso. Usa o `useClock` partilhado com o header e o
 * login — um só temporizador para os três, que pára em segundo plano.
 */
export default function ClockWidget(): React.JSX.Element {
  const now = useClock();

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mono text-[clamp(24px,7vw,40px)] font-light leading-none tracking-tight">
        {formatTime(now)}
      </div>

      <div className="mt-2 truncate text-[12.5px] capitalize text-t2">{formatLongDate(now)}</div>

      <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-t3">
        {resolveTimeZone()}
      </div>
    </div>
  );
}

function resolveTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone.replace(/_/g, ' ');
  } catch {
    // Ambiente sem Intl completo — o campo simplesmente não informa.
    return '—';
  }
}
