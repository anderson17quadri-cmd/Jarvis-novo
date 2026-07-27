import { useEffect, useState } from 'react';

import type { PollingDataService } from '@/services/data-service';
import { useIsVisible } from './use-platform';

/**
 * Liga um componente a qualquer serviço de dados com sondagem.
 *
 * Um só hook para meteorologia, notícias, email e música — todos herdam de
 * `PollingDataService`. Sem isto seriam quatro hooks iguais a menos do tipo.
 *
 * Vários componentes podem subscrever o mesmo serviço: a sondagem é uma só, e
 * suspende quando a janela vai para segundo plano.
 */
export function useDataService<T>(service: PollingDataService<T>): {
  readonly data: T | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
  readonly refresh: () => void;
} {
  const [data, setData] = useState<T | null>(() => service.current);
  const [hasLoaded, setHasLoaded] = useState(() => service.current !== null);
  const isVisible = useIsVisible();

  useEffect(() => {
    return service.subscribe((value) => {
      setData(value);
      setHasLoaded(true);
    });
  }, [service]);

  useEffect(() => {
    service.setPaused(!isVisible);
  }, [isVisible, service]);

  return {
    data,
    isLoading: !hasLoaded,
    refresh: () => void service.refresh(),
  };
}
