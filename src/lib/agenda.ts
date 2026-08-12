import type { AgendaEntry } from '@/types/calendar';

/**
 * Funções puras sobre a agenda — não dependem de serviço nem store.
 *
 * Viviam em `@/data/agenda`; agora que os dados vêm do `CalendarService`,
 * estas funções operam sobre as entradas que o snapshot devolve.
 */

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
export function currentEntry(
  now: Date,
  agenda: readonly AgendaEntry[],
): AgendaEntry | null {
  const minutes = now.getHours() * 60 + now.getMinutes();

  return (
    agenda.find((entry) => {
      const start = minutesOf(entry);
      return minutes >= start && minutes < start + entry.durationMinutes;
    }) ?? null
  );
}

/** A próxima que ainda não começou, ou `null` se o dia já acabou. */
export function nextEntry(
  now: Date,
  agenda: readonly AgendaEntry[],
): AgendaEntry | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return agenda.find((entry) => minutesOf(entry) > minutes) ?? null;
}

/** Quantos minutos faltam para uma entrada começar. Negativo se já começou. */
export function minutesUntil(entry: AgendaEntry, now: Date): number {
  return minutesOf(entry) - (now.getHours() * 60 + now.getMinutes());
}
