import { beforeEach, describe, expect, it } from 'vitest';

import { overlaps } from '@/components/widgets/grid';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { useWidgetStore } from '@/stores/use-widget-store';
import { ALL_WIDGETS } from '@/widgets/registry';
import { GRID_COLUMNS, GRID_ROWS, type PersistedWidgetLayout } from '@/types/widget';

describe('useWidgetStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useWidgetStore.setState({ widgets: [] });
  });

  describe('arranjo predefinido', () => {
    it('coloca todos os widgets registados', async () => {
      await useWidgetStore.getState().hydrate();
      expect(useWidgetStore.getState().widgets).toHaveLength(ALL_WIDGETS.length);
    });

    it('nenhum se sobrepõe a outro', async () => {
      await useWidgetStore.getState().hydrate();
      const placements = useWidgetStore.getState().widgets.map((w) => w.placement);

      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          expect(
            overlaps(placements[i]!, placements[j]!),
            `${i} sobrepõe-se a ${j}`,
          ).toBe(false);
        }
      }
    });

    it('todos cabem dentro da grelha', async () => {
      await useWidgetStore.getState().hydrate();

      for (const widget of useWidgetStore.getState().widgets) {
        const { col, row, colSpan, rowSpan } = widget.placement;
        expect(col + colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
        expect(row + rowSpan).toBeLessThanOrEqual(GRID_ROWS);
      }
    });
  });

  describe('mostrar e esconder', () => {
    it('esconder mantém o widget no store, para não perder a posição', async () => {
      await useWidgetStore.getState().hydrate();
      const total = useWidgetStore.getState().widgets.length;

      useWidgetStore.getState().hide('clock');

      expect(useWidgetStore.getState().widgets).toHaveLength(total);
      expect(useWidgetStore.getState().widgets.find((w) => w.id === 'clock')?.isVisible).toBe(false);
    });

    it('alternar duas vezes volta ao estado inicial', async () => {
      await useWidgetStore.getState().hydrate();

      useWidgetStore.getState().toggle('cpu');
      expect(useWidgetStore.getState().widgets.find((w) => w.id === 'cpu')?.isVisible).toBe(false);

      useWidgetStore.getState().toggle('cpu');
      expect(useWidgetStore.getState().widgets.find((w) => w.id === 'cpu')?.isVisible).toBe(true);
    });

    it('mostrar um widget nunca colocado dá-lhe um lugar livre', () => {
      useWidgetStore.setState({ widgets: [] });
      useWidgetStore.getState().show('ram');

      const [widget] = useWidgetStore.getState().widgets;
      expect(widget?.id).toBe('ram');
      expect(widget?.isVisible).toBe(true);
    });
  });

  describe('mover e redimensionar', () => {
    it('mover para um sítio livre respeita o destino', async () => {
      await useWidgetStore.getState().hydrate();
      useWidgetStore.setState({
        widgets: [{ id: 'clock', placement: { col: 0, row: 0, colSpan: 3, rowSpan: 2 }, isVisible: true }],
      });

      useWidgetStore.getState().move('clock', { col: 5, row: 3 });
      const { placement } = useWidgetStore.getState().widgets[0]!;

      expect(placement.col).toBe(5);
      expect(placement.row).toBe(3);
    });

    it('mover para cima de outro não os sobrepõe', () => {
      useWidgetStore.setState({
        widgets: [
          { id: 'clock', placement: { col: 0, row: 0, colSpan: 3, rowSpan: 2 }, isVisible: true },
          { id: 'cpu', placement: { col: 6, row: 0, colSpan: 4, rowSpan: 3 }, isVisible: true },
        ],
      });

      useWidgetStore.getState().move('clock', { col: 6, row: 0 });
      const [clock, cpu] = useWidgetStore.getState().widgets;

      expect(overlaps(clock!.placement, cpu!.placement)).toBe(false);
    });

    it('redimensionar aplica o span do tamanho pedido', () => {
      useWidgetStore.setState({
        widgets: [{ id: 'clock', placement: { col: 0, row: 0, colSpan: 3, rowSpan: 2 }, isVisible: true }],
      });

      useWidgetStore.getState().resize('clock', 'large');
      const { placement } = useWidgetStore.getState().widgets[0]!;

      expect(placement.colSpan).toBe(6);
      expect(placement.rowSpan).toBe(4);
    });

    it('redimensionar junto à margem recua em vez de transbordar', () => {
      useWidgetStore.setState({
        widgets: [{ id: 'clock', placement: { col: 10, row: 0, colSpan: 2, rowSpan: 2 }, isVisible: true }],
      });

      useWidgetStore.getState().resize('clock', 'large');
      const { placement } = useWidgetStore.getState().widgets[0]!;

      expect(placement.col + placement.colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
    });
  });

  describe('persistência', () => {
    it('guarda e repõe o arranjo', async () => {
      await useWidgetStore.getState().hydrate();
      useWidgetStore.getState().move('clock', { col: 8, row: 4 });
      useWidgetStore.getState().hide('cpu');
      await useWidgetStore.getState().persist();

      useWidgetStore.setState({ widgets: [] });
      await useWidgetStore.getState().hydrate();

      const clock = useWidgetStore.getState().widgets.find((w) => w.id === 'clock');
      const cpu = useWidgetStore.getState().widgets.find((w) => w.id === 'cpu');

      expect(clock?.placement.col).toBe(8);
      expect(cpu?.isVisible).toBe(false);
    });

    it('descarta widgets guardados que já não existem no registo', async () => {
      const stale: PersistedWidgetLayout[] = [
        { id: 'clock', placement: { col: 0, row: 0, colSpan: 3, rowSpan: 2 }, isVisible: true },
        // Removido entre versões — sem o filtro, rebentava na renderização.
        { id: 'widget-que-ja-nao-existe', placement: { col: 4, row: 0, colSpan: 3, rowSpan: 2 }, isVisible: true },
      ] as unknown as PersistedWidgetLayout[];

      await storageService.set(STORAGE_KEYS.widgetLayout, stale);
      await useWidgetStore.getState().hydrate();

      expect(useWidgetStore.getState().widgets).toHaveLength(1);
      expect(useWidgetStore.getState().widgets[0]?.id).toBe('clock');
    });

    it('uma posição guardada fora dos limites é trazida para dentro', async () => {
      const outOfBounds: PersistedWidgetLayout[] = [
        { id: 'clock', placement: { col: 40, row: 40, colSpan: 3, rowSpan: 2 }, isVisible: true },
      ];

      await storageService.set(STORAGE_KEYS.widgetLayout, outOfBounds);
      await useWidgetStore.getState().hydrate();

      const { placement } = useWidgetStore.getState().widgets[0]!;
      expect(placement.col + placement.colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
      expect(placement.row + placement.rowSpan).toBeLessThanOrEqual(GRID_ROWS);
    });

    it('repor devolve o arranjo predefinido', async () => {
      await useWidgetStore.getState().hydrate();
      useWidgetStore.getState().hide('clock');
      useWidgetStore.getState().hide('cpu');

      useWidgetStore.getState().reset();

      expect(
        useWidgetStore.getState().widgets.every((widget) => widget.isVisible),
      ).toBe(true);
    });
  });
});
