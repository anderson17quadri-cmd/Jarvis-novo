import { useCallback } from 'react';

import { getAppDefinition } from '@/apps/registry';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { soundService } from '@/services/sound-service';
import { applyWorkspace } from '@/services/workspace-service';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import type { DesktopId, WorkspaceSnapshot } from '@/types/workspace';
import { centeredRect } from './use-app-launcher';
import { useIsCompact } from './use-media-query';

/**
 * Mudar de desktop e aplicar layouts (Partes 6.2 e 15).
 *
 * A store guarda as fotografias; o serviço sabe repô-las; este hook é quem
 * conhece o ecrã, e por isso é quem decide onde cada janela cabe. No compacto
 * a geometria guardada não se aplica — as janelas empilham-se com a largura
 * toda, e repor posições de um monitor daria um resultado sem sentido.
 */
export function useWorkspace(): {
  readonly goToDesktop: (id: DesktopId) => void;
  readonly applyLayout: (layoutId: string) => boolean;
} {
  const isCompact = useIsCompact();

  const restore = useCallback(
    (snapshot: WorkspaceSnapshot): void => {
      applyWorkspace(snapshot, (entry) => {
        const definition = getAppDefinition(entry.appId);

        // Um layout predefinido vem sem geometria — a posição calcula-se aqui,
        // com o ecrã que há.
        const hasGeometry = entry.rect.width > 0 && entry.rect.height > 0;
        return isCompact || !hasGeometry ? centeredRect(definition.defaultSize) : entry.rect;
      });

      void useWindowStore.getState().persistLayout();
      void useWidgetStore.getState().persist();
    },
    [isCompact],
  );

  const goToDesktop = useCallback(
    (id: DesktopId): void => {
      const snapshot = useWorkspaceStore.getState().switchTo(id);

      // `null` quer dizer "já lá estava" ou "nunca foi visitado". Nos dois
      // casos não há nada a repor, e o ecrã fica como está.
      if (snapshot !== null) restore(snapshot);
      soundService.play('open');
    },
    [restore],
  );

  const applyLayout = useCallback(
    (layoutId: string): boolean => {
      const layout = useWorkspaceStore.getState().getLayout(layoutId);
      if (!layout) return false;

      restore(layout.snapshot);
      // O layout passa a ser o conteúdo do desktop atual — senão, mudar de
      // desktop e voltar desfazia-o.
      useWorkspaceStore.getState().syncCurrent();

      eventBus.emit('layout:aplicado', { layout: layout.name });
      logService.audit(`Aplicar o layout "${layout.name}"`, 'executado');
      return true;
    },
    [restore],
  );

  return { goToDesktop, applyLayout };
}
