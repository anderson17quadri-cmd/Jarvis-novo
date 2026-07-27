import { useEffect, useState } from 'react';

import { useIsVisible } from './use-platform';

/** Atualização a cada 15 segundos — chega para um relógio de horas e minutos. */
const TICK_MS = 15_000;

/**
 * Relógio partilhado pelo header e pelo login.
 *
 * Pára quando a janela vai para segundo plano e atualiza-se logo ao voltar, para
 * a hora não aparecer congelada no primeiro frame.
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  const isVisible = useIsVisible();

  useEffect(() => {
    if (!isVisible) return;

    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [isVisible]);

  return now;
}
