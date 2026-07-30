import { describe, expect, it } from 'vitest';

import { AGENDA, currentEntry, minutesOf, minutesUntil, nextEntry } from '@/data/agenda';

/** Um instante de hoje, à hora e minuto pedidos. */
function at(hours: number, minutes = 0): Date {
  return new Date(2026, 6, 28, hours, minutes);
}

describe('agenda', () => {
  it('converte a hora em minutos desde a meia-noite', () => {
    expect(minutesOf({ id: 'x', time: '14:30', title: '', detail: '', durationMinutes: 30 })).toBe(
      870,
    );
  });

  it('cada entrada tem identificador próprio', () => {
    const ids = new Set(AGENDA.map((entry) => entry.id));
    expect(ids.size).toBe(AGENDA.length);
  });

  it('está ordenada pela hora', () => {
    const minutes = AGENDA.map(minutesOf);
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });
});

describe('o que está a decorrer', () => {
  it('a reunião das 10:00 está a decorrer às 10:30', () => {
    expect(currentEntry(at(10, 30))?.id).toBe('reuniao');
  });

  it('mas já não às 11:00, quando a hora acabou', () => {
    expect(currentEntry(at(11))).toBeNull();
  });

  it('nada está a decorrer antes do primeiro compromisso', () => {
    expect(currentEntry(at(8))).toBeNull();
  });

  it('um compromisso que já passou não conta como a decorrer', () => {
    // Às 15:00 a reunião das 10:00 acabou há muito.
    expect(currentEntry(at(15))).toBeNull();
  });
});

describe('o que vem a seguir', () => {
  it('de manhã cedo é o primeiro do dia', () => {
    expect(nextEntry(at(7))?.id).toBe('reuniao');
  });

  it('durante um compromisso já aponta para o seguinte', () => {
    expect(nextEntry(at(10, 30))?.id).toBe('triagem');
  });

  it('depois do último não há seguinte', () => {
    expect(nextEntry(at(23))).toBeNull();
  });

  it('conta os minutos que faltam', () => {
    const next = nextEntry(at(9, 20));
    expect(next).not.toBeNull();
    expect(minutesUntil(next!, at(9, 20))).toBe(40);
  });

  it('um compromisso já começado dá um valor negativo', () => {
    const [first] = AGENDA;
    expect(minutesUntil(first!, at(12))).toBeLessThan(0);
  });
});
