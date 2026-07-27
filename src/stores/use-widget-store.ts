import { create } from 'zustand';

import { clampPlacement, findFreeSlot, resolveDrop } from '@/components/widgets/grid';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { ALL_WIDGETS, getWidgetDefinition } from '@/widgets/registry';
import {
  WIDGET_SIZES,
  type PersistedWidgetLayout,
  type WidgetId,
  type WidgetInstance,
  type WidgetPlacement,
  type WidgetSizeName,
} from '@/types/widget';

interface WidgetState {
  widgets: readonly WidgetInstance[];

  /** Mostra um widget, procurando-lhe lugar se ainda não estiver colocado. */
  show: (id: WidgetId) => void;
  hide: (id: WidgetId) => void;
  toggle: (id: WidgetId) => void;
  /** Move um widget, resolvendo colisões. */
  move: (id: WidgetId, target: { col: number; row: number }) => void;
  resize: (id: WidgetId, size: WidgetSizeName) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Repõe o arranjo predefinido. */
  reset: () => void;
}

/** Widgets visíveis à primeira utilização, já sem se sobreporem. */
function defaultLayout(): WidgetInstance[] {
  const placed: WidgetInstance[] = [];

  for (const definition of ALL_WIDGETS) {
    const size = WIDGET_SIZES[definition.defaultSize];
    const slot = findFreeSlot(
      placed.map((widget) => widget.placement),
      size.colSpan,
      size.rowSpan,
    );
    if (!slot) continue;

    placed.push({ id: definition.id, placement: slot, isVisible: true });
  }

  return placed;
}

export const useWidgetStore = create<WidgetState>((set, get) => ({
  widgets: [],

  show: (id) =>
    set((state) => {
      const existing = state.widgets.find((widget) => widget.id === id);
      if (existing) {
        return {
          widgets: state.widgets.map((widget) =>
            widget.id === id ? { ...widget, isVisible: true } : widget,
          ),
        };
      }

      const size = WIDGET_SIZES[getWidgetDefinition(id).defaultSize];
      const slot = findFreeSlot(
        state.widgets.filter((w) => w.isVisible).map((w) => w.placement),
        size.colSpan,
        size.rowSpan,
      );
      // Sem espaço, não se empilha por cima — o widget simplesmente não entra.
      if (!slot) return state;

      return { widgets: [...state.widgets, { id, placement: slot, isVisible: true }] };
    }),

  hide: (id) =>
    set((state) => ({
      widgets: state.widgets.map((widget) =>
        widget.id === id ? { ...widget, isVisible: false } : widget,
      ),
    })),

  toggle: (id) => {
    const current = get().widgets.find((widget) => widget.id === id);
    if (current?.isVisible) get().hide(id);
    else get().show(id);
  },

  move: (id, target) =>
    set((state) => {
      const moving = state.widgets.find((widget) => widget.id === id);
      if (!moving) return state;

      const others = state.widgets
        .filter((widget) => widget.id !== id && widget.isVisible)
        .map((widget) => widget.placement);

      const placement = resolveDrop(moving.placement, target, others);

      return {
        widgets: state.widgets.map((widget) =>
          widget.id === id ? { ...widget, placement } : widget,
        ),
      };
    }),

  resize: (id, size) =>
    set((state) => {
      const target = state.widgets.find((widget) => widget.id === id);
      if (!target) return state;

      const span = WIDGET_SIZES[size];
      const desired = clampPlacement({ ...target.placement, ...span });

      return {
        widgets: state.widgets.map((widget) =>
          widget.id === id ? { ...widget, placement: desired } : widget,
        ),
      };
    }),

  persist: async () => {
    const layout: PersistedWidgetLayout[] = get().widgets.map((widget) => ({
      id: widget.id,
      placement: widget.placement,
      isVisible: widget.isVisible,
    }));

    await storageService.set(STORAGE_KEYS.widgetLayout, layout);
  },

  hydrate: async () => {
    const saved = await storageService.get<PersistedWidgetLayout[]>(
      STORAGE_KEYS.widgetLayout,
      [],
    );

    if (saved.length === 0) {
      set({ widgets: defaultLayout() });
      return;
    }

    // Um widget guardado que já não exista no registo é descartado — acontece
    // ao remover um widget entre versões, e sem isto rebentaria na renderização.
    const known = new Set(ALL_WIDGETS.map((definition) => definition.id));

    set({
      widgets: saved
        .filter((entry) => known.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          placement: clampPlacement(entry.placement),
          isVisible: entry.isVisible,
        })),
    });
  },

  reset: () => set({ widgets: defaultLayout() }),
}));

/** Só os visíveis — é o que a grelha desenha. */
export function selectVisibleWidgets(state: WidgetState): readonly WidgetInstance[] {
  return state.widgets.filter((widget) => widget.isVisible);
}

export type { WidgetPlacement };
