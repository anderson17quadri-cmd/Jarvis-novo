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

/**
 * Que borda a janela encaixa, dada a posição do ponteiro ao largar.
 *
 * Segue a convenção do Windows: topo maximiza, esquerda e direita ocupam
 * metade do ecrã.
 */
export function detectSnapEdge(pointerX: number, pointerY: number, viewport: Viewport): SnapEdge {
  if (pointerY <= viewport.topInset + SNAP_THRESHOLD_PX) return 'top';
  if (pointerX <= viewport.leftInset + SNAP_THRESHOLD_PX) return 'left';
  if (pointerX >= viewport.width - SNAP_THRESHOLD_PX) return 'right';
  return 'none';
}

/** A geometria que corresponde a cada encaixe. */
export function rectForSnapEdge(edge: SnapEdge, viewport: Viewport): WindowRect | null {
  const availableWidth = viewport.width - viewport.leftInset;
  const availableHeight = viewport.height - viewport.topInset - viewport.bottomInset;

  switch (edge) {
    case 'top':
      return {
        x: viewport.leftInset,
        y: viewport.topInset,
        width: availableWidth,
        height: availableHeight,
      };
    case 'left':
      return {
        x: viewport.leftInset,
        y: viewport.topInset,
        width: Math.round(availableWidth / 2),
        height: availableHeight,
      };
    case 'right':
      return {
        x: viewport.leftInset + Math.round(availableWidth / 2),
        y: viewport.topInset,
        width: Math.round(availableWidth / 2),
        height: availableHeight,
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
