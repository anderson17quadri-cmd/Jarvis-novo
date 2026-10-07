import { createId } from '@/lib/id';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import type { CalendarEvent, CalendarEventDraft, CalendarSnapshot } from '@/types/calendar';
import type { CalendarProvider } from './calendar-provider';

export function calendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validate(event: CalendarEventDraft): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
    !Number.isFinite(Date.parse(`${event.date}T12:00:00Z`)) ||
    new Date(`${event.date}T12:00:00Z`).toISOString().slice(0, 10) !== event.date) throw new Error('A data do evento não é válida.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) throw new Error('A hora do evento não é válida.');
  if (!event.title.trim() || event.title.length > 200) throw new Error('Indica um título até 200 caracteres.');
  if (typeof event.detail !== 'string' || event.detail.length > 1000) throw new Error('A descrição é demasiado longa.');
  if (!Number.isInteger(event.durationMinutes) || event.durationMinutes < 1 || event.durationMinutes > 1440) {
    throw new Error('A duração deve ficar entre 1 e 1440 minutos.');
  }
}

export class LocalCalendarProvider implements CalendarProvider {
  readonly id = 'local';
  readonly name = 'Agenda local';
  private events: readonly CalendarEvent[] = [];
  private loading: Promise<void> | null = null;
  private writes: Promise<unknown> = Promise.resolve();

  isConfigured(): boolean { return true; }

  private load(): Promise<void> {
    this.loading ??= storageService.get<readonly CalendarEvent[]>(STORAGE_KEYS.calendarEvents, []).then(events => {
      if (!Array.isArray(events)) throw new Error('A agenda guardada não tem um formato válido.');
      for (const event of events as readonly CalendarEvent[]) {
        if (!event || typeof event.id !== 'string' || typeof event.title !== 'string') throw new Error('Há um evento inválido na agenda guardada.');
        validate(event);
      }
      this.events = events;
    }).catch(error => { this.loading = null; throw error; });
    return this.loading;
  }

  async fetch(date = new Date()): Promise<CalendarSnapshot> {
    await this.load();
    const day = calendarDate(date);
    return { date: day, isSimulated: false,
      entries: this.events.filter(event => event.date === day).sort((a, b) => a.time.localeCompare(b.time)) };
  }

  private change<T>(action: () => Promise<T>): Promise<T> {
    const result = this.writes.then(action, action);
    this.writes = result;
    return result;
  }

  create(draft: CalendarEventDraft): Promise<CalendarEvent> {
    return this.change(async () => {
      validate(draft); await this.load();
      const event = { ...draft, title: draft.title.trim(), id: createId('evento') };
      const next = [...this.events, event];
      await storageService.set(STORAGE_KEYS.calendarEvents, next);
      this.events = next;
      return event;
    });
  }

  update(id: string, draft: CalendarEventDraft): Promise<void> {
    return this.change(async () => {
      validate(draft); await this.load();
      if (!this.events.some(event => event.id === id)) throw new Error('Esse evento já não existe.');
      const next = this.events.map(event => event.id === id ? { ...draft, title: draft.title.trim(), id } : event);
      await storageService.set(STORAGE_KEYS.calendarEvents, next);
      this.events = next;
    });
  }

  remove(id: string): Promise<void> {
    return this.change(async () => {
      await this.load();
      const next = this.events.filter(event => event.id !== id);
      await storageService.set(STORAGE_KEYS.calendarEvents, next);
      this.events = next;
    });
  }
}
