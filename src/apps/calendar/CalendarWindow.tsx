import { AGENDA, currentEntry } from '@/data/agenda';
import { useClock } from '@/hooks/use-clock';
import { cn } from '@/lib/cn';
import { formatLongDate } from '@/lib/format';

export default function CalendarWindow(): React.JSX.Element {
  const now = useClock();
  const current = currentEntry(now);

  return (
    <div>
      <p className="t-label mb-3">{formatLongDate(now)}</p>

      <ul>
        {AGENDA.map((entry) => (
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
    </div>
  );
}
