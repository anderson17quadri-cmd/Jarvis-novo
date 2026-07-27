import type { SnapEdge, WindowRect } from '@/types/window';

/** Distância à borda, em pixels, a partir da qual a janela encaixa. */
export const SNAP_THRESHOLD_PX = 24;

export interface Viewport {
  readonly width: number;
  readonly height: number;
  /** Altura do header — nenhuma janela sobe acima dele. */
  readonly topInset: number;
  /** Largura do rail — nenhuma janela entra por baixo dele. */
  readonly leftInset: number;
  /** Espaço reservado ao dock, no fundo. */
  readonly bottomInset: number;
}

/** Altura da faixa, em cada canto, que conta como quarto em vez de metade. */
const CORNER_ZONE_PX = 120;

/**
 * Onde a janela encaixa, dada a posição do ponteiro ao largar.
 *
 * Segue a convenção do Windows: topo maximiza, laterais ocupam metade, e os
 * cantos ocupam um quarto. Os cantos são testados primeiro — quem larga a
 * janela no canto superior esquerdo quer o quarto, não o ecrã inteiro.
 */
export function detectSnapEdge(pointerX: number, pointerY: number, viewport: Viewport): SnapEdge {
  const atLeft = pointerX <= viewport.leftInset + SNAP_THRESHOLD_PX;
  const atRight = pointerX >= viewport.width - SNAP_THRESHOLD_PX;
  const atTop = pointerY <= viewport.topInset + SNAP_THRESHOLD_PX;

  const nearTop = pointerY <= viewport.topInset + CORNER_ZONE_PX;
  const nearBottom = pointerY >= viewport.height - viewport.bottomInset - CORNER_ZONE_PX;

  if (atLeft && nearTop) return 'top-left';
  if (atRight && nearTop) return 'top-right';
  if (atLeft && nearBottom) return 'bottom-left';
  if (atRight && nearBottom) return 'bottom-right';

  if (atTop) return 'top';
  if (atLeft) return 'left';
  if (atRight) return 'right';
  return 'none';
}

/** A geometria que corresponde a cada encaixe. */
export function rectForSnapEdge(edge: SnapEdge, viewport: Viewport): WindowRect | null {
  const fullWidth = viewport.width - viewport.leftInset;
  const fullHeight = viewport.height - viewport.topInset - viewport.bottomInset;
  const halfWidth = Math.round(fullWidth / 2);
  const halfHeight = Math.round(fullHeight / 2);

  const left = viewport.leftInset;
  const right = viewport.leftInset + halfWidth;
  const top = viewport.topInset;
  const bottom = viewport.topInset + halfHeight;

  switch (edge) {
    case 'top':
      return { x: left, y: top, width: fullWidth, height: fullHeight };
    case 'left':
      return { x: left, y: top, width: halfWidth, height: fullHeight };
    case 'right':
      return { x: right, y: top, width: fullWidth - halfWidth, height: fullHeight };
    case 'top-left':
      return { x: left, y: top, width: halfWidth, height: halfHeight };
    case 'top-right':
      return { x: right, y: top, width: fullWidth - halfWidth, height: halfHeight };
    case 'bottom-left':
      return { x: left, y: bottom, width: halfWidth, height: fullHeight - halfHeight };
    case 'bottom-right':
      return {
        x: right,
        y: bottom,
        width: fullWidth - halfWidth,
        height: fullHeight - halfHeight,
      };
    case 'none':
      return null;
  }
}

/** Geometria de uma janela maximizada. */
export function maximizedRect(viewport: Viewport): WindowRect {
  return {
    x: viewport.leftInset,
    y: viewport.topInset,
    width: viewport.width - viewport.leftInset,
    height: viewport.height - viewport.topInset - viewport.bottomInset,
  };
}

/**
 * Mantém a janela alcançável.
 *
 * Só a posição é limitada, não o tamanho: uma janela maior que o ecrã continua
 * a poder ser arrastada, mas a barra de título nunca sai do sítio onde se lhe
 * pode pegar. Sem isto, arrastar uma janela para fora perdia-a para sempre.
 */
export function clampPosition(
  position: { x: number; y: number },
  viewport: Viewport,
): { x: number; y: number } {
  /** Quanto da janela tem de continuar dentro do ecrã. */
  const minVisible = 120;
  const titleBarHeight = 44;

  return {
    x: Math.max(0, Math.min(viewport.width - minVisible, position.x)),
    y: Math.max(viewport.topInset, Math.min(viewport.height - titleBarHeight, position.y)),
  };
}

/** Lê o viewport atual a partir do DOM. */
export function readViewport(): Viewport {
  const styles = getComputedStyle(document.documentElement);
  const readPx = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    topInset: readPx('--header-h', 72),
    leftInset: readPx('--rail-w', 88),
    // Espaço do dock mais a margem inferior.
    bottomInset: 90,
  };
}
