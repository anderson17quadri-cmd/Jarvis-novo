import { PollingDataService } from '../data-service';
import type { CalendarProvider } from './providers/calendar-provider';
import { LocalCalendarProvider } from './providers/local-calendar-provider';
import type { CalendarEventDraft, CalendarSnapshot } from '@/types/calendar';

/** A agenda renova-se a cada hora — não muda com frequência. */
const CALENDAR_INTERVAL_MS = 60 * 60_000;

export class CalendarService extends PollingDataService<CalendarSnapshot> {
  constructor(private provider: CalendarProvider = new LocalCalendarProvider()) {
    super({ intervalMs: CALENDAR_INTERVAL_MS });
  }

  get providerName(): string {
    return this.provider.name;
  }

  get isSimulated(): boolean {
    return this.current?.isSimulated ?? true;
  }

  setProvider(provider: CalendarProvider): void {
    this.provider = provider;
    void this.refresh();
  }

  get isEditable(): boolean {
    return typeof this.provider.create === 'function' && typeof this.provider.update === 'function' && typeof this.provider.remove === 'function';
  }

  async listDay(date: string): Promise<CalendarSnapshot | null> {
    return this.provider.fetch(new Date(`${date}T12:00:00`));
  }

  async saveEvent(event: CalendarEventDraft, id?: string): Promise<void> {
    if (!this.provider.create || !this.provider.update) throw new Error('Esta agenda não permite edição.');
    if (id) await this.provider.update(id, event);
    else await this.provider.create(event);
    // Espera por uma leitura anterior à mutação antes de publicar a atual.
    await this.refresh();
    await this.refresh();
  }

  async deleteEvent(id: string): Promise<void> {
    if (!this.provider.remove) throw new Error('Esta agenda não permite edição.');
    await this.provider.remove(id);
    await this.refresh();
    await this.refresh();
  }

  protected async fetch(): Promise<CalendarSnapshot | null> {
    if (!this.provider.isConfigured()) return null;
    return this.provider.fetch();
  }
}

export const calendarService = new CalendarService();
