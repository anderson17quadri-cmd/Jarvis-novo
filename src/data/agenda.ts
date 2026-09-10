/**
 * Re-exportação para compatibilidade.
 *
 * Os tipos e funções migraram para `@/types/calendar`, `@/lib/agenda` e
 * `@/services/calendar`. Este ficheiro continua a exportar o que o código
 * antigo espera, mas o caminho canónico é o novo.
 *
 * @deprecated Usa `@/types/calendar` para os tipos e `@/lib/agenda` para as
 *   funções puras. Os dados vivos vêm do `CalendarService`.
 */

export type { AgendaEntry } from '@/types/calendar';
import {
  minutesOf as _minutesOf,
  currentEntry as _currentEntry,
  nextEntry as _nextEntry,
  minutesUntil as _minutesUntil,
} from '@/lib/agenda';
import type { AgendaEntry } from '@/types/calendar';

/** Dados de exemplo, os mesmos que o `MockCalendarProvider` devolve. */
export const AGENDA: readonly AgendaEntry[] = [
  {
    id: 'reuniao',
    time: '10:00',
    title: 'Reunião de projeto',
    detail: 'Agendado.pt · 1h',
    durationMinutes: 60,
  },
  {
    id: 'triagem',
    time: '14:30',
    title: 'Triagem de emails',
    detail: '30 min',
    durationMinutes: 30,
  },
  {
    id: 'deep-work',
    time: '16:00',
    title: 'Deep work',
    detail: 'Voxel game · 2h',
    durationMinutes: 120,
  },
  {
    id: 'revisao',
    time: '19:00',
    title: 'Revisão do dia',
    detail: '15 min',
    durationMinutes: 15,
  },
];

// Wrappers com o default que o código antigo espera.
export const minutesOf = _minutesOf;
export const currentEntry = (now: Date, agenda: readonly AgendaEntry[] = AGENDA) =>
  _currentEntry(now, agenda);
export const nextEntry = (now: Date, agenda: readonly AgendaEntry[] = AGENDA) =>
  _nextEntry(now, agenda);
export const minutesUntil = _minutesUntil;
