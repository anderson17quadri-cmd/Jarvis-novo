import { useEffect } from 'react';

import { WidgetEmpty, WidgetError } from '@/components/widgets/WidgetStates';
import { useClock } from '@/hooks/use-clock';
import { useIsVisible } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { currentEntry, minutesUntil, nextEntry } from '@/lib/agenda';
import { calendarService } from '@/services/calendar/calendar-service';
import { useCalendarStore } from '@/stores/use-calendar-store';

/**
 * Calendário (Parte 6.2 §Widgets previstos).
 *
 * O que está a decorrer, ou quanto falta para o próximo, e o resto do dia por
 * baixo. Os dados vêm do `CalendarService` via `useCalendarStore` — o widget
 * não importa `@/data/agenda` diretamente.
 */
export default function CalendarWidget(): React.JSX.Element {
  const now = useClock();
  const snapshot = useCalendarStore((s) => s.snapshot);
  const isLoading = useCalendarStore((s) => s.isLoading);
  const error = useCalendarStore((s) => s.error);
  const refresh = useCalendarStore((s) => s.refresh);
  const isVisible = useIsVisible();

  useEffect(() => {
    const unsub = useCalendarStore.getState().hydrate();
    return unsub;
  }, []);

  useEffect(() => {
    calendarService.setPaused(!isVisible);
  }, [isVisible]);

  if (!snapshot && error) {
    return <WidgetError message="Não consegui ler a agenda." onRetry={() => void refresh()} />;
  }
  if (isLoading || !snapshot) return <WidgetEmpty message="A ler a agenda…" />;

  const entries = snapshot.entries;
  const current = currentEntry(now, entries);
  const next = nextEntry(now, entries);
  const upcoming = entries.filter((entry) => entry.id !== current?.id);

  if (entries.length === 0) return <WidgetEmpty message="Nada agendado para hoje." />;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex-shrink-0">
        {current ? (
          <>
            <p className="truncate text-[15px] font-medium leading-tight compact:text-[13px]">
              {current.title}
            </p>
            <p className="mt-0.5 text-[11px] text-accent">a decorrer agora</p>
          </>
        ) : next ? (
          <>
            <p className="mono text-[22px] font-light leading-none compact:text-[18px]">
              {formatCountdown(minutesUntil(next, now))}
            </p>
            <p className="mt-1 truncate text-[11px] text-t2">até {next.title}</p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-medium leading-tight compact:text-[13px]">
              O dia está feito
            </p>
            <p className="mt-0.5 text-[11px] text-t3">Nada mais agendado.</p>
          </>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {upcoming.map((entry) => {
          const isPast = minutesUntil(entry, now) < 0;

          return (
            <li
              key={entry.id}
              className={cn('flex items-baseline gap-2 py-1', isPast && 'opacity-45')}
            >
              <span
                className={cn(
                  'mt-1 h-[5px] w-[5px] flex-shrink-0 rounded-full',
                  entry.id === next?.id ? 'bg-accent' : 'bg-t3',
                )}
                aria-hidden="true"
              />
              <span className="mono flex-shrink-0 text-[10px] text-t3">{entry.time}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px]">{entry.title}</span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-danger">
          Não consegui atualizar — a mostrar a última agenda lida.
        </p>
      )}
      {snapshot.isSimulated && (
        <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-t3">Agenda simulada</p>
      )}
    </div>
  );
}

/** "1h 20m" ou "45m". Vive aqui porque só este widget conta para a frente. */
function formatCountdown(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
