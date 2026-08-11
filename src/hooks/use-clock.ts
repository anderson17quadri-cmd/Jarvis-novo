import { useEffect } from 'react';

import { useIsVisible } from './use-platform';
import { useClockStore } from '@/stores/use-clock-store';

/**
 * Relógio partilhado pelo header, login, calendário e widget do relógio.
 *
 * A hora vem da `useClockStore`, que por sua vez subscreve o `ClockService`
 * — um só temporizador para todos os componentes, que pára quando a janela
 * vai para segundo plano.
 */
export function useClock(): Date {
  const now = useClockStore((s) => s.now);
  const isVisible = useIsVisible();

  useEffect(() => {
    const unsub = useClockStore.getState().hydrate();
    return unsub;
  }, []);

  useEffect(() => {
    useClockStore.getState().setPaused(!isVisible);
  }, [isVisible]);

  return now;
}
