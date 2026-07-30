/**
 * Agenda do dia (Parte 6.2 §Calendário).
 *
 * Vive aqui porque a janela e o widget mostram a mesma coisa, e duas cópias
 * divergiriam à primeira alteração. Na Fase 2 passa a vir de um provedor de
 * calendário real — os tipos já são os que um devolve.
 */

export interface AgendaEntry {
  readonly id: string;
  /** Hora de início, em "HH:MM". */
  readonly time: string;
  readonly title: string;
  readonly detail: string;
  /** Duração em minutos, para o widget saber o que ainda está a decorrer. */
  readonly durationMinutes: number;
}

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

/** Minutos desde a meia-noite de uma entrada. */
export function minutesOf(entry: AgendaEntry): number {
  const [hours = 0, minutes = 0] = entry.time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * O que está a decorrer agora, ou `null`.
 *
 * "A decorrer" é entre o início e o fim, não "a próxima que já passou": um
 * compromisso das 10:00 que durou uma hora não está a decorrer às 15:00.
 */
export function currentEntry(now: Date, agenda: readonly AgendaEntry[] = AGENDA): AgendaEntry | null {
  const minutes = now.getHours() * 60 + now.getMinutes();

  return (
    agenda.find((entry) => {
      const start = minutesOf(entry);
      return minutes >= start && minutes < start + entry.durationMinutes;
    }) ?? null
  );
}

/** A próxima que ainda não começou, ou `null` se o dia já acabou. */
export function nextEntry(now: Date, agenda: readonly AgendaEntry[] = AGENDA): AgendaEntry | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return agenda.find((entry) => minutesOf(entry) > minutes) ?? null;
}

/** Quantos minutos faltam para uma entrada começar. Negativo se já começou. */
export function minutesUntil(entry: AgendaEntry, now: Date): number {
  return minutesOf(entry) - (now.getHours() * 60 + now.getMinutes());
}
