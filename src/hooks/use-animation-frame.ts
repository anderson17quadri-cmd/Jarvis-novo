import { useEffect, useRef } from 'react';

import { useIsVisible } from './use-platform';
import { useReducedMotion } from './use-media-query';

/**
 * Loop de animação partilhado por todos os canvas.
 *
 * Faz três coisas que cada componente teria de repetir: pára quando a janela vai
 * para segundo plano, respeita `prefers-reduced-motion` e mantém a callback
 * atualizada sem reiniciar o loop a cada render.
 *
 * @param callback recebe o tempo em milissegundos desde o arranque do loop
 * @param enabled  desligar sem desmontar o componente
 */
export function useAnimationFrame(callback: (elapsedMs: number) => void, enabled = true): void {
  const callbackRef = useRef(callback);
  const isVisible = useIsVisible();
  const reducedMotion = useReducedMotion();

  // Guardar a callback numa ref evita reiniciar o rAF quando o componente
  // re-renderiza — senão o tempo saltava a cada mudança de estado.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !isVisible) return;

    // Com movimento reduzido desenhamos um frame estático e ficamos por aí.
    if (reducedMotion) {
      callbackRef.current(0);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number): void => {
      start ??= now;
      callbackRef.current(now - start);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, isVisible, reducedMotion]);
}

/** Limite de densidade de pixels — acima de 2 o custo não compensa. */
export const MAX_DPR = 2;

export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, MAX_DPR);
}
