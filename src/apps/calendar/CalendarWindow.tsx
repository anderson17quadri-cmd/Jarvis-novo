import { useEffect, useState } from 'react';
import { useClock } from '@/hooks/use-clock';
import { calendarService } from '@/services/calendar/calendar-service';
import { calendarDate } from '@/services/calendar/providers/local-calendar-provider';
import { useCalendarStore } from '@/stores/use-calendar-store';
import type { CalendarEventDraft, CalendarSnapshot } from '@/types/calendar';

const FIELD = 'w-full rounded-input border border-line bg-black/20 px-3 py-2 text-desc text-t1';

export default function CalendarWindow(): React.JSX.Element {
  const now = useClock();
  const latest = useCalendarStore(state => state.snapshot);
  const [date, setDate] = useState(calendarDate(now));
  const [snapshot, setSnapshot] = useState<CalendarSnapshot | null>(null);
  const [draft, setDraft] = useState<CalendarEventDraft | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => useCalendarStore.getState().hydrate(), []);
  useEffect(() => {
    let cancelled = false;
    void calendarService.listDay(date).then(value => {
      if (!cancelled) { setSnapshot(value); setError(''); }
    }).catch((failure: unknown) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : 'Não consegui ler a agenda.');
    });
    return () => { cancelled = true; };
  }, [date, revision, latest]);

  async function save(): Promise<void> {
    if (!draft) return;
    setSaving(true); setError('');
    try {
      await calendarService.saveEvent(draft, editingId);
      setDate(draft.date); setDraft(null); setEditingId(undefined);
      setRevision(value => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não consegui guardar o evento.'); }
    finally { setSaving(false); }
  }
  async function remove(id: string): Promise<void> {
    setSaving(true); setError('');
    try { await calendarService.deleteEvent(id); setRevision(value => value + 1); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não consegui apagar o evento.'); }
    finally { setSaving(false); }
  }
  const entries = snapshot?.date === date ? snapshot.entries : [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-cap text-t3">{calendarService.isEditable ? 'Agenda local · guardada neste dispositivo' : 'Agenda de demonstração'}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-cap text-t3">Dia da agenda
          <input type="date" className={FIELD} value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} />
        </label>
        {calendarService.isEditable && <button type="button" disabled={saving}
          className="rounded-input border border-accent/40 px-3 py-2 text-cap text-accent"
          onClick={() => { setEditingId(undefined); setDraft({ date, time: '09:00', title: '', detail: '', durationMinutes: 30 }); }}>
          Novo evento
        </button>}
      </div>
      {error && <p role="alert" className="text-cap text-danger">{error}</p>}
      {draft && <form className="flex flex-col gap-2 rounded-input border border-line p-3"
        onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="text-cap text-t3">Título do evento<input className={FIELD} required maxLength={200} value={draft.title}
          onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1 text-cap text-t3">Data do evento<input className={FIELD} type="date" required value={draft.date}
            onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
          <label className="min-w-0 flex-1 text-cap text-t3">Hora<input className={FIELD} type="time" required value={draft.time}
            onChange={event => setDraft({ ...draft, time: event.target.value })} /></label>
        </div>
        <label className="text-cap text-t3">Duração em minutos<input className={FIELD} type="number" required min={1} max={1440} value={draft.durationMinutes}
          onChange={event => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /></label>
        <label className="text-cap text-t3">Descrição<input className={FIELD} maxLength={1000} value={draft.detail}
          onChange={event => setDraft({ ...draft, detail: event.target.value })} /></label>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="text-cap text-accent">{saving ? 'A guardar…' : 'Guardar evento'}</button>
          <button type="button" disabled={saving} className="text-cap text-t3" onClick={() => setDraft(null)}>Cancelar</button>
        </div>
      </form>}
      <ul>{entries.map(entry => <li key={entry.id} className="flex items-start gap-3 border-b border-line py-3">
        <span className="mono text-cap text-t3">{entry.time}</span>
        <div className="min-w-0 flex-1"><p className="break-words text-desc">{entry.title}</p>
          <p className="break-words text-cap text-t3">{entry.durationMinutes} min{entry.detail ? ` · ${entry.detail}` : ''}</p></div>
        {calendarService.isEditable && <div className="flex flex-col gap-1 text-cap">
          <button type="button" disabled={saving} aria-label={`Editar ${entry.title}`} className="text-accent"
            onClick={() => { setEditingId(entry.id); setDraft({ ...entry, date }); }}>Editar</button>
          <button type="button" disabled={saving} aria-label={`Apagar ${entry.title}`} className="text-danger"
            onClick={() => { if (window.confirm(`Apagar o evento “${entry.title}”?`)) void remove(entry.id); }}>Apagar</button>
        </div>}
      </li>)}</ul>
      {snapshot?.date === date && entries.length === 0 && <p className="text-cap text-t3">Sem eventos neste dia.</p>}
    </div>
  );
}
