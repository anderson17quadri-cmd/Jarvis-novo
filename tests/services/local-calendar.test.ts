import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalCalendarProvider } from '@/services/calendar/providers/local-calendar-provider';
import { storageService } from '@/services/storage-service';

const event = { date: '2026-10-07', time: '14:30', title: 'Consulta', detail: 'Centro', durationMinutes: 30 };
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe('agenda local', () => {
  it('cria, edita, filtra o dia e reabre os eventos persistidos', async () => {
    const calendar = new LocalCalendarProvider();
    const created = await calendar.create(event);
    await calendar.update(created.id, { ...event, title: 'Consulta alterada', date: '2026-10-08' });
    expect((await calendar.fetch(new Date(2026, 9, 7))).entries).toEqual([]);
    const reopened = new LocalCalendarProvider();
    expect((await reopened.fetch(new Date(2026, 9, 8))).entries[0]?.title).toBe('Consulta alterada');
    await reopened.remove(created.id);
    expect((await new LocalCalendarProvider().fetch(new Date(2026, 9, 8))).entries).toEqual([]);
  });
  it('criações simultâneas não apagam uma à outra', async () => {
    const calendar = new LocalCalendarProvider();
    await Promise.all([calendar.create(event), calendar.create({ ...event, title: 'Reunião' })]);
    expect((await new LocalCalendarProvider().fetch(new Date(2026, 9, 7))).entries).toHaveLength(2);
  });
  it('falha de persistência mantém o evento anterior e uma data inválida é recusada', async () => {
    const calendar = new LocalCalendarProvider();
    const created = await calendar.create(event);
    vi.spyOn(storageService, 'set').mockRejectedValue(new Error('Disco indisponível'));
    await expect(calendar.remove(created.id)).rejects.toThrow('Disco');
    expect((await calendar.fetch(new Date(2026, 9, 7))).entries).toHaveLength(1);
    await expect(calendar.create({ ...event, date: '2026-02-30' })).rejects.toThrow(/data/i);
  });
});
