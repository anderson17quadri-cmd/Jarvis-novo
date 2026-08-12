import type { AgendaEntry, CalendarSnapshot } from '@/types/calendar';

/**
 * Contrato de um provedor de calendário.
 *
 * O calendário é maioritariamente de leitura — o serviço expõe `refresh` e
 * `subscribe`, e o provedor devolve os compromissos do dia. Mais tarde pode
 * ganhar `create`/`update`/`delete` para edição inline.
 */
export interface CalendarProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  fetch(date?: Date, signal?: AbortSignal): Promise<CalendarSnapshot | null>;
}

/** Compromissos de demonstração, os mesmos que estavam em `@/data/agenda`. */
const SEED: readonly AgendaEntry[] = [
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

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class MockCalendarProvider implements CalendarProvider {
  readonly id = 'mock';
  readonly name = 'Simulado';

  isConfigured(): boolean {
    return true;
  }

  async fetch(): Promise<CalendarSnapshot> {
    return {
      entries: SEED,
      date: todayString(),
      isSimulated: true,
    };
  }
}
