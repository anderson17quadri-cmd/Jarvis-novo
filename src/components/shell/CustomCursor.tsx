import { useEffect, useRef } from 'react';

import { useIsCoarsePointer, useReducedMotion } from '@/hooks/use-media-query';
import { useAppearanceStore } from '@/stores/use-appearance-store';

/** Elementos que fazem o anel crescer. */
const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], input, [data-cursor="hot"]';

/** Suavização do anel: 0 = não segue, 1 = cola ao ponteiro. */
const FOLLOW_EASING = 0.18;

/**
 * Cursor personalizado — um ponto que cola ao ponteiro e um anel que o persegue
 * com atraso.
 *
 * Desativado por completo em `pointer: coarse`: num ecrã de toque não há
 * ponteiro para seguir. Também sai de cena com `prefers-reduced-motion`, onde a
 * perseguição seria movimento gratuito.
 */
export function CustomCursor(): React.JSX.Element | null {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const isCoarsePointer = useIsCoarsePointer();
  const reducedMotion = useReducedMotion();
  const cursor = useAppearanceStore((state) => state.appearance.cursor);
  // Com o cursor do sistema não há nada para desenhar nem para seguir: o
  // componente sai de cena inteiro, sem listener nenhum registado.
  const disabled = isCoarsePointer || reducedMotion || cursor === 'sistema';

  useEffect(() => {
    if (disabled) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    let targetX = 0;
    let targetY = 0;
    let ringX = 0;
    let ringY = 0;
    let frame = 0;

    const onPointerMove = (event: PointerEvent): void => {
      targetX = event.clientX;
      targetY = event.clientY;
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;

      const target = event.target;
      const isInteractive =
        target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
      ring.classList.toggle('is-hot', isInteractive);
    };

    const follow = (): void => {
      ringX += (targetX - ringX) * FOLLOW_EASING;
      ringY += (targetY - ringY) * FOLLOW_EASING;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      frame = requestAnimationFrame(follow);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    frame = requestAnimationFrame(follow);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, [disabled]);

  if (disabled) return null;

  return (
    <div aria-hidden="true">
      <div ref={ringRef} className="cursor-ring" />
      <div ref={dotRef} className="cursor-dot" />
    </div>
  );
}
