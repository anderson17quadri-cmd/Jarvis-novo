import { useCallback, useEffect } from 'react';

import { getAppDefinition } from '@/apps/registry';
import { readViewport } from '@/components/windows/snap';
import { useIsCompact } from '@/hooks/use-media-query';
import { soundService } from '@/services/sound-service';
import { useWindowStore } from '@/stores/use-window-store';
import type { AppId } from '@/types/app';
import type { WindowRect } from '@/types/window';

/**
 * Abrir janelas.
 *
 * Centraliza o cálculo da posição inicial e a restauração do layout guardado,
 * para o dock, o rail e a paleta não terem de saber nada disso.
 */
export function useAppLauncher(): {
  readonly launch: (appId: AppId) => void;
  readonly restoreSavedLayout: () => Promise<void>;
} {
  const isCompact = useIsCompact();
  const open = useWindowStore((state) => state.open);
  const persistLayout = useWindowStore((state) => state.persistLayout);
  const loadLayout = useWindowStore((state) => state.loadLayout);

  const launch = useCallback(
    (appId: AppId): void => {
      const definition = getAppDefinition(appId);
      open(appId, definition.title, centeredRect(definition.defaultSize));
      soundService.play('open');
      void persistLayout();
    },
    [open, persistLayout],
  );

  const restoreSavedLayout = useCallback(async (): Promise<void> => {
    // No compacto a geometria guardada não se aplica: as janelas empilham-se
    // com a largura toda, e restaurar posições do desktop dava um resultado sem
    // sentido no telemóvel.
    const layout = await loadLayout();

    for (const entry of layout) {
      const definition = getAppDefinition(entry.appId);
      open(
        entry.appId,
        definition.title,
        isCompact ? centeredRect(definition.defaultSize) : entry.rect,
      );
    }
  }, [isCompact, loadLayout, open]);

  // Guardar o layout ao fechar a aplicação, além de a cada manipulação.
  useEffect(() => {
    const onBeforeUnload = (): void => void persistLayout();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [persistLayout]);

  return { launch, restoreSavedLayout };
}

/** Centra a janela no palco, com o rail e o header já descontados. */
function centeredRect(size: { readonly width: number; readonly height: number }): WindowRect {
  const viewport = readViewport();
  const availableWidth = viewport.width - viewport.leftInset;
  const availableHeight = viewport.height - viewport.topInset - viewport.bottomInset;

  return {
    x: viewport.leftInset + Math.max(0, (availableWidth - size.width) / 2),
    y: viewport.topInset + Math.max(0, (availableHeight - size.height) / 2),
    width: Math.min(size.width, availableWidth),
    height: Math.min(size.height, availableHeight),
  };
}
