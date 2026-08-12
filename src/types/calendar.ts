/** Calendário (Parte 6.2 §Widgets previstos). */

export interface AgendaEntry {
  readonly id: string;
  /** Hora de início, em "HH:MM". */
  readonly time: string;
  readonly title: string;
  readonly detail: string;
  /** Duração em minutos, para o widget saber o que ainda está a decorrer. */
  readonly durationMinutes: number;
}

export interface CalendarSnapshot {
  readonly entries: readonly AgendaEntry[];
  /** Data a que a agenda respeita, em "YYYY-MM-DD". */
  readonly date: string;
  readonly isSimulated: boolean;
}
