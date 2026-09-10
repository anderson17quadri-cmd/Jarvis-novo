import { useEffect } from 'react';

import { systemService } from '@/services/system-service';
import { useSystemStore } from '@/stores/use-system-store';
import type { HistoryPoint } from '@/stores/use-system-store';
import type { StaticSystemInfo, SystemSnapshot } from '@/types/system';
import { useIsVisible } from './use-platform';

interface SystemMetrics {
  readonly snapshot: SystemSnapshot | null;
  readonly staticInfo: StaticSystemInfo | null;
  readonly history: readonly HistoryPoint[];
  /** `false` quando a plataforma não sabe ler métricas. */
  readonly isSupported: boolean;
}

/**
 * Liga um componente às métricas do sistema.
 *
 * Vários componentes podem chamar isto ao mesmo tempo: o `SystemService`
 * mantém uma só sondagem e distribui o resultado. Quando a janela vai para
 * segundo plano a sondagem suspende — não faz sentido pedir métricas a um ecrã
 * que ninguém está a ver.
 */
export function useSystemMetrics(): SystemMetrics {
  const snapshot = useSystemStore((state) => state.snapshot);
  const staticInfo = useSystemStore((state) => state.staticInfo);
  const history = useSystemStore((state) => state.history);
  const isSupported = useSystemStore((state) => state.isSupported);
  const isVisible = useIsVisible();

  useEffect(() => {
    const store = useSystemStore.getState();
    store.setSupported(systemService.isSupported);

    if (!systemService.isSupported) return;

    void systemService.getStaticInfo().then((info) => {
      useSystemStore.getState().setStaticInfo(info);
    });

    return systemService.subscribe((next) => {
      useSystemStore.getState().setSnapshot(next);
    });
  }, []);

  useEffect(() => {
    systemService.setPaused(!isVisible);
  }, [isVisible]);

  return { snapshot, staticInfo, history, isSupported };
}
