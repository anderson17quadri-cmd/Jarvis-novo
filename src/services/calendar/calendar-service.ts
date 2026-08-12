import { PollingDataService } from '../data-service';
import { MockCalendarProvider, type CalendarProvider } from './providers/calendar-provider';
import type { CalendarSnapshot } from '@/types/calendar';

/** A agenda renova-se a cada hora — não muda com frequência. */
const CALENDAR_INTERVAL_MS = 60 * 60_000;

export class CalendarService extends PollingDataService<CalendarSnapshot> {
  constructor(private provider: CalendarProvider = new MockCalendarProvider()) {
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

  protected async fetch(): Promise<CalendarSnapshot | null> {
    if (!this.provider.isConfigured()) return null;
    return this.provider.fetch();
  }
}

export const calendarService = new CalendarService();
