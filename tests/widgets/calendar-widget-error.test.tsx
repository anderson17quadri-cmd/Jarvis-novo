import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import CalendarWidget from '@/widgets/calendar/CalendarWidget';
import { calendarService } from '@/services/calendar/calendar-service';
import { MockCalendarProvider, type CalendarProvider } from '@/services/calendar/providers/calendar-provider';
import { useCalendarStore } from '@/stores/use-calendar-store';

/**
 * Testes de erro em separado de `tests/widgets/productivity-widgets.test.tsx`
 * (que já cobre o widget de Calendário) — aqui só a rede de segurança nova
 * (item 15, revisão adversarial de `src/widgets/`, 20/08/2026).
 */
class FailingCalendarProvider implements CalendarProvider {
  readonly id = 'failing';
  readonly name = 'Falha';
  isConfigured(): boolean {
    return true;
  }
  fetch(): Promise<never> {
    return Promise.reject(new Error('sem acesso'));
  }
}

beforeEach(() => {
  useCalendarStore.setState({ snapshot: null, isLoading: true, error: null });
});

afterEach(() => {
  calendarService.setProvider(new MockCalendarProvider());
});

describe('widget de Calendário — erro não fica em silêncio', () => {
  it('sem nenhuma leitura boa ainda, uma falha mostra o estado de erro', async () => {
    calendarService.setProvider(new FailingCalendarProvider());

    render(<CalendarWidget />);

    expect(await screen.findByText('Não consegui ler a agenda.')).toBeInTheDocument();
  });
});
