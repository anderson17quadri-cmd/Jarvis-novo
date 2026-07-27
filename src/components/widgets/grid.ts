import {
  GRID_COLUMNS,
  GRID_GAP,
  GRID_ROW_HEIGHT,
  GRID_ROWS,
  type WidgetPlacement,
} from '@/types/widget';

/**
 * Matemática da grelha de widgets.
 *
 * Fora de qualquer componente: é aritmética pura, testável sem montar React.
 * A grelha tem 12 colunas de largura fluida e linhas de altura fixa — as
 * colunas acompanham o palco, as linhas não, para o conteúdo de um widget não
 * mudar de altura só porque a janela mudou de largura.
 */

export interface GridMetrics {
  /** Largura útil do palco, em pixels. */
  readonly width: number;
  readonly columns: number;
  readonly rowHeight: number;
  readonly gap: number;
}

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function createMetrics(width: number, columns = GRID_COLUMNS): GridMetrics {
  return { width, columns, rowHeight: GRID_ROW_HEIGHT, gap: GRID_GAP };
}

/** Largura de uma coluna, já com os espaços descontados. */
export function columnWidth(metrics: GridMetrics): number {
  const totalGaps = metrics.gap * (metrics.columns - 1);
  return Math.max(0, (metrics.width - totalGaps) / metrics.columns);
}

/** Converte uma ocupação em células para pixels. */
export function placementToPixels(
  placement: WidgetPlacement,
  metrics: GridMetrics,
): PixelRect {
  const colW = columnWidth(metrics);

  return {
    x: placement.col * (colW + metrics.gap),
    y: placement.row * (metrics.rowHeight + metrics.gap),
    // O span inclui os espaços interiores: um widget de 2 colunas ocupa duas
    // colunas mais o espaço entre elas, senão ficaria mais estreito que o slot.
    width: placement.colSpan * colW + (placement.colSpan - 1) * metrics.gap,
    height: placement.rowSpan * metrics.rowHeight + (placement.rowSpan - 1) * metrics.gap,
  };
}

/** Converte uma posição em pixels na célula mais próxima. */
export function pixelsToCell(
  x: number,
  y: number,
  metrics: GridMetrics,
): { col: number; row: number } {
  const colW = columnWidth(metrics);

  return {
    col: Math.round(x / (colW + metrics.gap)),
    row: Math.round(y / (metrics.rowHeight + metrics.gap)),
  };
}

/**
 * Trava uma ocupação dentro dos limites da grelha.
 *
 * Um widget arrastado para fora da margem direita recua até caber, em vez de
 * ficar cortado — e nunca se permite coluna ou linha negativa.
 */
export function clampPlacement(
  placement: WidgetPlacement,
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): WidgetPlacement {
  const colSpan = Math.min(Math.max(1, placement.colSpan), columns);
  const rowSpan = Math.max(1, placement.rowSpan);

  return {
    colSpan,
    rowSpan,
    col: Math.min(Math.max(0, placement.col), columns - colSpan),
    row: Math.min(Math.max(0, placement.row), Math.max(0, rows - rowSpan)),
  };
}

/** Duas ocupações sobrepõem-se? */
export function overlaps(a: WidgetPlacement, b: WidgetPlacement): boolean {
  const horizontal = a.col < b.col + b.colSpan && b.col < a.col + a.colSpan;
  const vertical = a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
  return horizontal && vertical;
}

/**
 * Encontra o primeiro lugar livre para uma ocupação do tamanho pedido.
 *
 * Varre da esquerda para a direita e de cima para baixo — a mesma ordem por que
 * se lê. Devolve `null` se não houver espaço, e quem chama decide o que fazer;
 * empilhar por cima seria pior do que recusar.
 */
export function findFreeSlot(
  occupied: readonly WidgetPlacement[],
  colSpan: number,
  rowSpan: number,
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): WidgetPlacement | null {
  const span = { colSpan: Math.min(colSpan, columns), rowSpan };

  for (let row = 0; row + span.rowSpan <= rows; row++) {
    for (let col = 0; col + span.colSpan <= columns; col++) {
      const candidate: WidgetPlacement = { col, row, ...span };
      if (!occupied.some((taken) => overlaps(candidate, taken))) return candidate;
    }
  }

  return null;
}

/**
 * Encontra o lugar livre mais próximo de um destino.
 *
 * Distinto de `findFreeSlot`, que varre a partir do canto: aqui ordena-se pela
 * distância ao sítio onde o utilizador largou. Sem isto, largar um widget sobre
 * outro mandava-o de volta para o canto superior esquerdo — que costuma ser
 * exatamente de onde tinha saído, e o arrasto parecia não funcionar.
 */
export function findNearestFreeSlot(
  occupied: readonly WidgetPlacement[],
  colSpan: number,
  rowSpan: number,
  target: { col: number; row: number },
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): WidgetPlacement | null {
  const span = { colSpan: Math.min(colSpan, columns), rowSpan };
  let best: WidgetPlacement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row + span.rowSpan <= rows; row++) {
    for (let col = 0; col + span.colSpan <= columns; col++) {
      const candidate: WidgetPlacement = { col, row, ...span };
      if (occupied.some((taken) => overlaps(candidate, taken))) continue;

      // Distância ao quadrado — comparar é o que importa, a raiz é supérflua.
      const distance = (col - target.col) ** 2 + (row - target.row) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }

  return best;
}

/**
 * Resolve o largar de um widget numa posição.
 *
 * Se o destino estiver livre, é esse. Se estiver ocupado, vai para o lugar
 * livre mais próximo. Se não houver nenhum, fica onde estava — largar nunca
 * pode fazer um widget desaparecer.
 */
export function resolveDrop(
  moving: WidgetPlacement,
  target: { col: number; row: number },
  others: readonly WidgetPlacement[],
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): WidgetPlacement {
  const desired = clampPlacement(
    { ...target, colSpan: moving.colSpan, rowSpan: moving.rowSpan },
    columns,
    rows,
  );

  if (!others.some((other) => overlaps(desired, other))) return desired;

  return (
    findNearestFreeSlot(others, moving.colSpan, moving.rowSpan, desired, columns, rows) ??
    moving
  );
}

/** Altura total da grelha, em pixels. */
export function gridHeight(rows = GRID_ROWS, metrics?: GridMetrics): number {
  const rowHeight = metrics?.rowHeight ?? GRID_ROW_HEIGHT;
  const gap = metrics?.gap ?? GRID_GAP;
  return rows * rowHeight + (rows - 1) * gap;
}
