import { useCallback, useRef } from 'react';

import { clampPosition, detectSnapEdge, readViewport, rectForSnapEdge } from '@/components/windows/snap';
import type { SnapEdge, WindowRect } from '@/types/window';

interface DragCallbacks {
  readonly onMove: (position: { x: number; y: number }) => void;
  /** Chamado ao largar. `snapRect` é `null` quando não houve encaixe. */
  readonly onDrop: (snapRect: WindowRect | null) => void;
  /** Pré-visualização do encaixe enquanto se arrasta. */
  readonly onSnapPreview: (edge: SnapEdge) => void;
  readonly enabled: boolean;
}

/**
 * Arrastar uma janela pela barra de título.
 *
 * Usa Pointer Events, que cobrem rato, caneta e toque com um só código —
 * o protótipo tinha caminhos separados para `mouse` e `touch`.
 * `setPointerCapture` garante que o arrasto não se perde se o ponteiro sair da
 * barra, que é o que acontecia com listeners no `document`.
 */
export function useWindowDrag(
  rect: WindowRect,
  { onMove, onDrop, onSnapPreview, enabled }: DragCallbacks,
): { readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void } {
  const stateRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, edge: 'none' as SnapEdge });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      // Os botões da barra não arrastam a janela.
      if (!enabled || event.target instanceof Element && event.target.closest('[data-window-control]')) {
        return;
      }

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      stateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.x,
        originY: rect.y,
        edge: 'none',
      };

      const onPointerMove = (moveEvent: PointerEvent): void => {
        const viewport = readViewport();

        onMove(
          clampPosition(
            {
              x: stateRef.current.originX + (moveEvent.clientX - stateRef.current.startX),
              y: stateRef.current.originY + (moveEvent.clientY - stateRef.current.startY),
            },
            viewport,
          ),
        );

        const edge = detectSnapEdge(moveEvent.clientX, moveEvent.clientY, viewport);
        if (edge !== stateRef.current.edge) {
          stateRef.current.edge = edge;
          onSnapPreview(edge);
        }
      };

      const onPointerUp = (): void => {
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);

        onSnapPreview('none');
        onDrop(rectForSnapEdge(stateRef.current.edge, readViewport()));
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    },
    [enabled, onDrop, onMove, onSnapPreview, rect.x, rect.y],
  );

  return { onPointerDown };
}

interface ResizeCallbacks {
  readonly onResize: (size: { width: number; height: number }) => void;
  readonly onEnd: () => void;
  readonly enabled: boolean;
}

/** Redimensionar pelo canto inferior direito. */
export function useWindowResize(
  rect: WindowRect,
  { onResize, onEnd, enabled }: ResizeCallbacks,
): { readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void } {
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      if (!enabled) return;

      // Sem isto, o mesmo gesto também arrastava a janela.
      event.stopPropagation();

      const grip = event.currentTarget;
      grip.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = rect.width;
      const startHeight = rect.height;

      const onPointerMove = (moveEvent: PointerEvent): void => {
        onResize({
          width: startWidth + (moveEvent.clientX - startX),
          height: startHeight + (moveEvent.clientY - startY),
        });
      };

      const onPointerUp = (): void => {
        grip.removeEventListener('pointermove', onPointerMove);
        grip.removeEventListener('pointerup', onPointerUp);
        grip.removeEventListener('pointercancel', onPointerUp);
        onEnd();
      };

      grip.addEventListener('pointermove', onPointerMove);
      grip.addEventListener('pointerup', onPointerUp);
      grip.addEventListener('pointercancel', onPointerUp);
    },
    [enabled, onEnd, onResize, rect.height, rect.width],
  );

  return { onPointerDown };
}
