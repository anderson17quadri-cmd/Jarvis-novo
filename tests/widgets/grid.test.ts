import { describe, expect, it } from 'vitest';

import {
  clampPlacement,
  columnWidth,
  createMetrics,
  findFreeSlot,
  findNearestFreeSlot,
  overlaps,
  pixelsToCell,
  placementToPixels,
  resolveDrop,
} from '@/components/widgets/grid';
import { GRID_COLUMNS, GRID_ROWS, type WidgetPlacement } from '@/types/widget';

/** Palco de 1200px com as 12 colunas predefinidas. */
const METRICS = createMetrics(1200);

function place(col: number, row: number, colSpan = 3, rowSpan = 2): WidgetPlacement {
  return { col, row, colSpan, rowSpan };
}

describe('geometria da grelha', () => {
  it('as colunas repartem a largura, já sem os espaços', () => {
    const width = columnWidth(METRICS);
    const total = width * GRID_COLUMNS + METRICS.gap * (GRID_COLUMNS - 1);
    expect(total).toBeCloseTo(METRICS.width, 5);
  });

  it('a primeira célula começa na origem', () => {
    const rect = placementToPixels(place(0, 0, 1, 1), METRICS);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });

  it('um widget de 12 colunas ocupa a largura toda', () => {
    const rect = placementToPixels(place(0, 0, GRID_COLUMNS, 1), METRICS);
    expect(rect.width).toBeCloseTo(METRICS.width, 5);
  });

  it('o span inclui os espaços interiores', () => {
    const single = placementToPixels(place(0, 0, 1, 1), METRICS);
    const double = placementToPixels(place(0, 0, 2, 1), METRICS);
    // Duas colunas mais o espaço entre elas — senão ficaria mais estreito que o slot.
    expect(double.width).toBeCloseTo(single.width * 2 + METRICS.gap, 5);
  });

  it('converter para pixels e voltar devolve a mesma célula', () => {
    for (const [col, row] of [
      [0, 0],
      [3, 2],
      [9, 5],
    ] as const) {
      const rect = placementToPixels(place(col, row), METRICS);
      expect(pixelsToCell(rect.x, rect.y, METRICS)).toEqual({ col, row });
    }
  });

  it('uma posição a meio caminho encaixa na célula mais próxima', () => {
    const rect = placementToPixels(place(4, 0), METRICS);
    const nudged = pixelsToCell(rect.x + 6, rect.y + 4, METRICS);
    expect(nudged.col).toBe(4);
  });

  it('uma largura de zero não gera larguras negativas', () => {
    expect(columnWidth(createMetrics(0))).toBe(0);
  });
});

describe('limites da grelha', () => {
  it('recua um widget que passe a margem direita', () => {
    const clamped = clampPlacement(place(11, 0, 4, 2));
    expect(clamped.col + clamped.colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
  });

  it('não permite coluna nem linha negativas', () => {
    const clamped = clampPlacement(place(-5, -3));
    expect(clamped.col).toBe(0);
    expect(clamped.row).toBe(0);
  });

  it('não deixa um widget passar a última linha', () => {
    const clamped = clampPlacement(place(0, GRID_ROWS + 4, 3, 2));
    expect(clamped.row + clamped.rowSpan).toBeLessThanOrEqual(GRID_ROWS);
  });

  it('trava um span maior que a grelha', () => {
    expect(clampPlacement(place(0, 0, 99, 1)).colSpan).toBe(GRID_COLUMNS);
  });

  it('nenhum span desce abaixo de 1', () => {
    const clamped = clampPlacement(place(0, 0, 0, 0));
    expect(clamped.colSpan).toBe(1);
    expect(clamped.rowSpan).toBe(1);
  });
});

describe('colisões', () => {
  it('deteta sobreposição parcial', () => {
    expect(overlaps(place(0, 0, 4, 2), place(2, 1, 4, 2))).toBe(true);
  });

  it('células encostadas não se sobrepõem', () => {
    expect(overlaps(place(0, 0, 3, 2), place(3, 0, 3, 2))).toBe(false);
    expect(overlaps(place(0, 0, 3, 2), place(0, 2, 3, 2))).toBe(false);
  });

  it('é simétrico', () => {
    const a = place(1, 1, 5, 3);
    const b = place(3, 2, 4, 2);
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe('procurar lugar livre', () => {
  it('coloca o primeiro widget na origem', () => {
    expect(findFreeSlot([], 3, 2)).toEqual(place(0, 0, 3, 2));
  });

  it('coloca o seguinte ao lado, não por cima', () => {
    const slot = findFreeSlot([place(0, 0, 3, 2)], 3, 2);
    expect(slot).not.toBeNull();
    expect(overlaps(slot!, place(0, 0, 3, 2))).toBe(false);
  });

  it('devolve null quando não há espaço, em vez de empilhar', () => {
    const full = Array.from({ length: GRID_ROWS }, (_, row) =>
      place(0, row, GRID_COLUMNS, 1),
    );
    expect(findFreeSlot(full, 3, 2)).toBeNull();
  });

  it('nunca devolve um lugar fora dos limites', () => {
    const slot = findFreeSlot([], GRID_COLUMNS, GRID_ROWS);
    expect(slot).not.toBeNull();
    expect(slot!.col + slot!.colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
    expect(slot!.row + slot!.rowSpan).toBeLessThanOrEqual(GRID_ROWS);
  });
});

describe('largar um widget', () => {
  it('aceita o destino quando está livre', () => {
    const moving = place(0, 0);
    const result = resolveDrop(moving, { col: 6, row: 3 }, []);
    expect(result.col).toBe(6);
    expect(result.row).toBe(3);
  });

  it('não sobrepõe: desvia para o lugar livre mais próximo', () => {
    const moving = place(0, 0);
    const occupied = [place(6, 3)];
    const result = resolveDrop(moving, { col: 6, row: 3 }, occupied);

    expect(overlaps(result, occupied[0]!)).toBe(false);
  });

  /*
   * Regressão. O desvio usava o primeiro lugar livre a contar do canto
   * superior esquerdo — que era quase sempre o sítio de onde o widget tinha
   * saído. O arrasto parecia não funcionar: largava-se longe e voltava ao
   * princípio.
   */
  it('ao desviar, fica perto do destino e não volta à origem', () => {
    const moving = place(0, 0, 3, 2);
    const occupied = [place(3, 0, 4, 3), place(7, 0, 4, 3)];

    const result = resolveDrop(moving, { col: 3, row: 3 }, occupied);

    expect(result).not.toEqual(moving);
    expect(result.row).toBeGreaterThanOrEqual(2);
    // Mais perto de onde se largou do que da origem.
    const toTarget = Math.abs(result.col - 3) + Math.abs(result.row - 3);
    const toOrigin = Math.abs(result.col - 0) + Math.abs(result.row - 0);
    expect(toTarget).toBeLessThan(toOrigin);
  });

  it('escolhe o candidato mais próximo entre vários livres', () => {
    // Só duas hipóteses: colada à esquerda ou colada à direita.
    const occupied = [place(0, 0, GRID_COLUMNS, 3), place(4, 3, 4, 2)];
    const result = findNearestFreeSlot(occupied, 3, 2, { col: 9, row: 3 });

    expect(result).not.toBeNull();
    expect(result!.col).toBeGreaterThan(4);
  });

  it('devolve null quando não há lugar nenhum perto nem longe', () => {
    const full = Array.from({ length: GRID_ROWS }, (_, row) =>
      place(0, row, GRID_COLUMNS, 1),
    );
    expect(findNearestFreeSlot(full, 3, 2, { col: 4, row: 4 })).toBeNull();
  });

  it('preserva o tamanho ao mover', () => {
    const moving = place(0, 0, 6, 4);
    const result = resolveDrop(moving, { col: 2, row: 1 }, []);
    expect(result.colSpan).toBe(6);
    expect(result.rowSpan).toBe(4);
  });

  it('largar fora da grelha não faz o widget desaparecer', () => {
    const moving = place(3, 2);
    const result = resolveDrop(moving, { col: 999, row: 999 }, []);

    expect(result.col).toBeGreaterThanOrEqual(0);
    expect(result.col + result.colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
    expect(result.row + result.rowSpan).toBeLessThanOrEqual(GRID_ROWS);
  });

  it('sem espaço nenhum, o widget fica onde estava', () => {
    const moving = place(0, 0, 3, 2);
    // Grelha cheia, tirando o sítio do próprio widget.
    const occupied = Array.from({ length: GRID_ROWS }, (_, row) =>
      place(0, row, GRID_COLUMNS, 1),
    );

    expect(resolveDrop(moving, { col: 5, row: 5 }, occupied)).toEqual(moving);
  });
});
