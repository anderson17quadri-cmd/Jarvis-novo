import { describe, expect, it } from 'vitest';

import {
  clampPosition,
  detectSnapEdge,
  maximizedRect,
  rectForSnapEdge,
  SNAP_THRESHOLD_PX,
  type Viewport,
} from '@/components/windows/snap';

const VIEWPORT: Viewport = {
  width: 1440,
  height: 900,
  topInset: 72,
  leftInset: 88,
  bottomInset: 90,
};

describe('deteção de encaixe', () => {
  it('encaixa no topo junto ao header', () => {
    expect(detectSnapEdge(700, VIEWPORT.topInset + 5, VIEWPORT)).toBe('top');
  });

  it('encaixa à esquerda junto ao rail', () => {
    expect(detectSnapEdge(VIEWPORT.leftInset + 5, 400, VIEWPORT)).toBe('left');
  });

  it('encaixa à direita junto à margem', () => {
    expect(detectSnapEdge(VIEWPORT.width - 5, 400, VIEWPORT)).toBe('right');
  });

  it('não encaixa no meio do palco', () => {
    expect(detectSnapEdge(700, 450, VIEWPORT)).toBe('none');
  });

  it('respeita o limiar em vez de encaixar por pouco', () => {
    const justOutside = VIEWPORT.leftInset + SNAP_THRESHOLD_PX + 1;
    expect(detectSnapEdge(justOutside, 400, VIEWPORT)).toBe('none');
  });
});

describe('geometria do encaixe', () => {
  it('a esquerda e a direita dividem o palco ao meio sem sobrepor', () => {
    const left = rectForSnapEdge('left', VIEWPORT);
    const right = rectForSnapEdge('right', VIEWPORT);

    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.x + left!.width).toBe(right!.x);
    expect(left!.width + right!.width).toBe(VIEWPORT.width - VIEWPORT.leftInset);
  });

  it('nenhum encaixe entra por baixo do rail ou do header', () => {
    for (const edge of ['top', 'left', 'right'] as const) {
      const rect = rectForSnapEdge(edge, VIEWPORT);
      expect(rect!.x).toBeGreaterThanOrEqual(VIEWPORT.leftInset);
      expect(rect!.y).toBeGreaterThanOrEqual(VIEWPORT.topInset);
    }
  });

  it('nenhum encaixe tapa o dock', () => {
    const rect = maximizedRect(VIEWPORT);
    expect(rect.y + rect.height).toBe(VIEWPORT.height - VIEWPORT.bottomInset);
  });

  it('"none" não devolve geometria', () => {
    expect(rectForSnapEdge('none', VIEWPORT)).toBeNull();
  });
});

describe('encaixe em quartos (Parte 6.2)', () => {
  it('deteta os quatro cantos', () => {
    const { leftInset, topInset, width, height, bottomInset } = VIEWPORT;

    expect(detectSnapEdge(leftInset + 2, topInset + 2, VIEWPORT)).toBe('top-left');
    expect(detectSnapEdge(width - 2, topInset + 2, VIEWPORT)).toBe('top-right');
    expect(detectSnapEdge(leftInset + 2, height - bottomInset - 10, VIEWPORT)).toBe('bottom-left');
    expect(detectSnapEdge(width - 2, height - bottomInset - 10, VIEWPORT)).toBe('bottom-right');
  });

  it('o canto ganha ao topo — quem larga no canto quer o quarto', () => {
    // Mesmo ponto que daria 'top' se os cantos não fossem testados primeiro.
    expect(detectSnapEdge(VIEWPORT.leftInset + 1, VIEWPORT.topInset + 1, VIEWPORT)).toBe('top-left');
  });

  it('a meio da lateral continua a ser metade, não quarto', () => {
    const middleY = VIEWPORT.topInset + (VIEWPORT.height - VIEWPORT.topInset) / 2;
    expect(detectSnapEdge(VIEWPORT.leftInset + 2, middleY, VIEWPORT)).toBe('left');
  });

  it('os quatro quartos cobrem o palco sem sobrepor nem deixar buraco', () => {
    const quarters = (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(
      (edge) => rectForSnapEdge(edge, VIEWPORT)!,
    );

    const totalArea = quarters.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    const stageArea =
      (VIEWPORT.width - VIEWPORT.leftInset) *
      (VIEWPORT.height - VIEWPORT.topInset - VIEWPORT.bottomInset);

    expect(totalArea).toBe(stageArea);
  });

  it('os quartos superiores encostam ao header e os inferiores ao dock', () => {
    const topLeft = rectForSnapEdge('top-left', VIEWPORT)!;
    const bottomLeft = rectForSnapEdge('bottom-left', VIEWPORT)!;

    expect(topLeft.y).toBe(VIEWPORT.topInset);
    expect(topLeft.y + topLeft.height).toBe(bottomLeft.y);
    expect(bottomLeft.y + bottomLeft.height).toBe(VIEWPORT.height - VIEWPORT.bottomInset);
  });
});

describe('a janela mantém-se alcançável', () => {
  it('não sobe acima do header', () => {
    expect(clampPosition({ x: 400, y: -500 }, VIEWPORT).y).toBe(VIEWPORT.topInset);
  });

  it('não desaparece pela direita', () => {
    const { x } = clampPosition({ x: 99_999, y: 300 }, VIEWPORT);
    expect(x).toBeLessThan(VIEWPORT.width);
  });

  it('não desaparece pela esquerda', () => {
    expect(clampPosition({ x: -99_999, y: 300 }, VIEWPORT).x).toBe(0);
  });

  it('deixa sempre a barra de título ao alcance do ponteiro', () => {
    const { y } = clampPosition({ x: 400, y: 99_999 }, VIEWPORT);
    expect(y).toBeLessThan(VIEWPORT.height);
  });
});
