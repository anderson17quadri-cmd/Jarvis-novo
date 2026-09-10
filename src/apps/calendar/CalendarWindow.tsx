import { useEffect } from 'react';

import { useClock } from '@/hooks/use-clock';
import { cn } from '@/lib/cn';
import { formatLongDate } from '@/lib/format';
import { currentEntry } from '@/lib/agenda';
import { useCalendarStore } from '@/stores/use-calendar-store';

export default function CalendarWindow(): React.JSX.Element {
  const now = useClock();
  const snapshot = useCalendarStore((s) => s.snapshot);

  useEffect(() => {
    const unsub = useCalendarStore.getState().hydrate();
    return unsub;
  }, []);

  const entries = snapshot?.entries ?? [];
  const current = currentEntry(now, entries);
  // O widget do calendário já dizia "Agenda simulada"; a janela — que é a
  // vista maior e mais convincente — não dizia nada, e apresentava
  // compromissos inventados como se fossem os da pessoa.
  const isSimulated = snapshot?.isSimulated ?? true;

  return (
    <div>
      <p className="t-label mb-3">{formatLongDate(now)}</p>

      <ul>
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex gap-3 border-b border-line py-[11px] last:border-b-0"
          >
            {/* O que está a decorrer respira; o resto fica com um ponto fixo. */}
            <span
              className={cn(
                'mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-accent',
                entry.id === current?.id
                  ? 'shadow-[0_0_8px_rgba(0,207,255,.55)] motion-safe:animate-breathe'
                  : 'opacity-45',
              )}
              aria-hidden="true"
            />
            <span className="mono min-w-[44px] pt-px text-cap text-t3">{entry.time}</span>
            <div>
              <div className="text-desc font-medium leading-[1.45]">{entry.title}</div>
              <div className="mt-0.5 text-[11.5px] text-t3">{entry.detail}</div>
            </div>
          </li>
        ))}
      </ul>

      {isSimulated && (
        <p className="mt-3 text-cap text-t3">
          Agenda simulada — não há calendário real ligado.
        </p>
      )}
    </div>
  );
}
