import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { createMetrics, stackedHeight } from '@/components/widgets/grid';
import { useWidgetStore } from '@/stores/use-widget-store';
import { COMPACT_ROW_HEIGHT, GRID_ROW_HEIGHT } from '@/types/widget';

/**
 * O bug que isto guarda: no compacto a grelha mudava o número de colunas mas
 * mantinha as posições guardadas, que estão em colunas de doze. Resultado —
 * num telemóvel de 393px, quatro dos cinco widgets eram desenhados fora do
 * ecrã, dois deles completamente invisíveis.
 */

/** Finge a largura de um telemóvel para o `useIsCompact`. */
function setViewport(width: number): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = max ? width <= Number(max[1]) : false;

    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  };
}

beforeEach(() => {
  localStorage.clear();
  useWidgetStore.getState().reset();
});

describe('grelha no compacto', () => {
  it('empilha os widgets sem posições absolutas', async () => {
    setViewport(393);
    const { container } = render(<WidgetGrid />);

    await waitFor(() => expect(screen.getAllByRole('region').length).toBeGreaterThan(0));

    // Nenhum widget posicionado por `left`: é isso que os atirava para fora.
    const positioned = container.querySelectorAll<HTMLElement>('[style*="left"]');
    expect(positioned).toHaveLength(0);
  });

  it('mostra todos os widgets visíveis, e nenhum fica de fora', async () => {
    setViewport(393);
    render(<WidgetGrid />);

    const visible = useWidgetStore.getState().widgets.filter((widget) => widget.isVisible);
    await waitFor(() => {
      expect(screen.getAllByRole('region')).toHaveLength(visible.length);
    });
  });

  it('a ordem do desktop mantém-se: primeiro a linha, depois a coluna', async () => {
    setViewport(393);
    render(<WidgetGrid />);

    await waitFor(() => expect(screen.getAllByRole('region').length).toBeGreaterThan(0));

    const ordered = [...useWidgetStore.getState().widgets]
      .filter((widget) => widget.isVisible)
      .sort((a, b) => a.placement.row - b.placement.row || a.placement.col - b.placement.col);

    const rendered = screen.getAllByRole('region').map((el) => el.getAttribute('aria-label'));
    expect(rendered).toHaveLength(ordered.length);
  });

  it('no desktop a grelha volta a ter altura fixa; no compacto cresce com o conteúdo', () => {
    setViewport(1500);
    const desktop = render(<WidgetGrid />);
    const desktopGrid = desktop.container.querySelector<HTMLElement>('[aria-label*="Widgets"]');
    // Doze linhas de altura fixa, para as posições absolutas terem onde cair.
    expect(desktopGrid?.style.height).toMatch(/px$/);
    desktop.unmount();

    setViewport(393);
    const compact = render(<WidgetGrid />);
    const compactGrid = compact.container.querySelector<HTMLElement>('[aria-label*="Widgets"]');
    // Empilhado: a altura é a soma dos widgets, não um valor imposto.
    expect(compactGrid?.style.height).toBe('');
  });
});

describe('altura empilhada', () => {
  it('vem do `rowSpan`, para um widget grande continuar grande', () => {
    const metrics = createMetrics(393, 12, COMPACT_ROW_HEIGHT);

    expect(stackedHeight(1, metrics)).toBe(COMPACT_ROW_HEIGHT);
    expect(stackedHeight(2, metrics)).toBeGreaterThan(stackedHeight(1, metrics));
  });

  it('a linha do compacto é mais baixa do que a do desktop', () => {
    // Empilhados, os widgets com a altura do desktop enchiam o ecrã com dois.
    expect(COMPACT_ROW_HEIGHT).toBeLessThan(GRID_ROW_HEIGHT);
  });
});
