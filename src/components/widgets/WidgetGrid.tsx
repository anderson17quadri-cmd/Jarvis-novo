import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useIsCompact } from '@/hooks/use-media-query';
import { selectVisibleWidgets, useWidgetStore } from '@/stores/use-widget-store';
import { getWidgetDefinition } from '@/widgets/registry';
import {
  GRID_COLUMNS,
  GRID_ROWS,
  type WidgetId,
  type WidgetPlacement,
  type WidgetSizeName,
} from '@/types/widget';
import { createMetrics, gridHeight, pixelsToCell, placementToPixels } from './grid';
import { Widget } from './Widget';

/** No compacto a grelha estreita para 4 colunas — 12 seriam ilegíveis. */
const COMPACT_COLUMNS = 4;

interface DragState {
  readonly id: WidgetId;
  /** Deslocamento do ponteiro ao ponto onde se pegou, em pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Grelha de widgets.
 *
 * Doze colunas fluidas e linhas de altura fixa (Parte 2 §Grid). Os widgets
 * encaixam em células, arrastam-se com Pointer Events e o arranjo persiste.
 *
 * Em ecrãs compactos a grelha passa a quatro colunas e o arrasto desliga-se —
 * reordenar por arrasto num telemóvel compete com o scroll da página.
 */
export function WidgetGrid(): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  /*
   * Espelho do arrasto numa ref. O `onPointerUp` precisa da posição final para
   * decidir a célula, mas lê-la de dentro de um updater do `setDrag` executaria
   * `move()` durante a renderização — o React avisa, e o `persist()` acabava a
   * guardar a posição antiga.
   */
  const dragRef = useRef<DragState | null>(null);

  const isCompact = useIsCompact();
  const widgets = useWidgetStore(useShallow(selectVisibleWidgets));
  const hydrate = useWidgetStore((state) => state.hydrate);
  const hide = useWidgetStore((state) => state.hide);
  const move = useWidgetStore((state) => state.move);
  const resize = useWidgetStore((state) => state.resize);
  const persist = useWidgetStore((state) => state.persist);

  const columns = isCompact ? COMPACT_COLUMNS : GRID_COLUMNS;
  const metrics = createMetrics(width, columns);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // A largura da grelha acompanha o palco; as colunas são fluidas.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = useCallback(
    (id: WidgetId, placement: WidgetPlacement) =>
      (event: React.PointerEvent<HTMLElement>): void => {
        if (isCompact || width === 0) return;

        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const rect = placementToPixels(placement, createMetrics(width, columns));
        const pointerX = event.clientX - containerRect.left;
        const pointerY = event.clientY - containerRect.top;

        event.currentTarget.setPointerCapture(event.pointerId);

        const initial: DragState = {
          id,
          offsetX: pointerX - rect.x,
          offsetY: pointerY - rect.y,
          x: rect.x,
          y: rect.y,
        };
        dragRef.current = initial;
        setDrag(initial);

        const handle = event.currentTarget;

        const onPointerMove = (moveEvent: PointerEvent): void => {
          const current = dragRef.current;
          if (!current) return;

          const next: DragState = {
            ...current,
            x: moveEvent.clientX - containerRect.left - current.offsetX,
            y: moveEvent.clientY - containerRect.top - current.offsetY,
          };
          dragRef.current = next;
          setDrag(next);
        };

        const onPointerUp = (): void => {
          handle.removeEventListener('pointermove', onPointerMove);
          handle.removeEventListener('pointerup', onPointerUp);
          handle.removeEventListener('pointercancel', onPointerUp);

          const final = dragRef.current;
          dragRef.current = null;
          setDrag(null);
          if (!final) return;

          // Fora de qualquer updater: o store já pode ser atualizado, e o
          // `persist` corre depois de a nova posição estar comprometida.
          const cell = pixelsToCell(final.x, final.y, createMetrics(width, columns));
          move(final.id, cell);
          void persist();
        };

        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
      },
    [columns, isCompact, move, persist, width],
  );

  const handleHide = useCallback(
    (id: WidgetId): void => {
      hide(id);
      void persist();
    },
    [hide, persist],
  );

  const handleResize = useCallback(
    (id: WidgetId, size: WidgetSizeName): void => {
      resize(id, size);
      void persist();
    },
    [persist, resize],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: gridHeight(GRID_ROWS, metrics) }}
      aria-label="Widgets do ambiente de trabalho"
    >
      {/* Guias da grelha, só enquanto se arrasta (Parte 6.2 §Arrastar). */}
      {drag !== null && <GridGuides columns={columns} />}

      {width > 0 &&
        widgets.map((widget) => {
          const definition = getWidgetDefinition(widget.id);
          const rect = placementToPixels(widget.placement, metrics);
          const isDragging = drag?.id === widget.id;

          return (
            <div
              key={widget.id}
              className={isDragging ? 'absolute z-20' : 'absolute z-10 transition-all duration-panel ease-out'}
              style={{
                left: isDragging ? drag.x : rect.x,
                top: isDragging ? drag.y : rect.y,
                width: rect.width,
                height: rect.height,
              }}
            >
              <Widget
                definition={definition}
                isDragging={isDragging}
                onHide={() => handleHide(widget.id)}
                onResize={(size) => handleResize(widget.id, size)}
                onPointerDown={handlePointerDown(widget.id, widget.placement)}
              />
            </div>
          );
        })}
    </div>
  );
}

/** Linhas-guia das colunas, para se perceber onde o widget vai encaixar. */
function GridGuides({ columns }: { readonly columns: number }): React.JSX.Element {
  return (
    <div
      className="pointer-events-none absolute inset-0 grid gap-s2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: columns }, (_, index) => (
        <div key={index} className="rounded-lg border border-dashed border-accent/15 bg-accent/[.02]" />
      ))}
    </div>
  );
}
