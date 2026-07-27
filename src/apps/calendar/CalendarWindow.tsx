import { useClock } from '@/hooks/use-clock';
import { formatLongDate } from '@/lib/format';

interface AgendaEntry {
  readonly time: string;
  readonly title: string;
  readonly detail: string;
}

/** Agenda do dia. Na Fase 2 passa a vir de um provedor de calendário real. */
const AGENDA: readonly AgendaEntry[] = [
  { time: '10:00', title: 'Reunião de projeto', detail: 'Agendado.pt · 1h' },
  { time: '14:30', title: 'Triagem de emails', detail: '30 min' },
  { time: '16:00', title: 'Deep work', detail: 'Voxel game · 2h' },
  { time: '19:00', title: 'Revisão do dia', detail: '15 min' },
];

export default function CalendarWindow(): React.JSX.Element {
  const now = useClock();

  return (
    <div>
      <p className="t-label mb-3">{formatLongDate(now)}</p>

      <ul>
        {AGENDA.map((entry) => (
          <li
            key={entry.time}
            className="flex gap-3 border-b border-line py-[11px] last:border-b-0"
          >
            <span
              className="mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-accent shadow-[0_0_8px_rgba(0,207,255,.55)]"
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
