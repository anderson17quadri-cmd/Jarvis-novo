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
 * @param callback recebe o tempo em milissegundos desde o primeiro arranque —
 *                 continua a crescer ao voltar do segundo plano, não recomeça
 * @param enabled  desligar sem desmontar o componente
 */
export function useAnimationFrame(callback: (elapsedMs: number) => void, enabled = true): void {
  const callbackRef = useRef(callback);
  const startRef = useRef<number | null>(null);
  const isVisible = useIsVisible();
  const reducedMotion = useReducedMotion();

  // Guardar a callback numa ref evita reiniciar o rAF quando o componente
  // re-renderiza — senão o tempo saltava a cada mudança de estado.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Com movimento reduzido não há loop: desenha-se um frame estático. Vive num
  // efeito próprio, dependente da callback, para que mudar de modo ou de cor o
  // redesenhe — senão o canvas ficava preso no primeiro estado para sempre.
  useEffect(() => {
    if (!enabled || !isVisible || !reducedMotion) return;
    callbackRef.current(0);
  }, [callback, enabled, isVisible, reducedMotion]);

  useEffect(() => {
    if (!enabled || !isVisible || reducedMotion) return;

    let frame = 0;

    const tick = (now: number): void => {
      // O `start` vive numa ref, não no efeito: quando a janela volta do
      // segundo plano, o `elapsed` continua a partir de onde ia. Se recomeçasse
      // em 0, um consumidor que calcula o delta entre frames (o `AICore`) veria
      // um salto negativo de centenas de frames num só — item 15, revisão a sério.
      if (startRef.current === null) startRef.current = now;
      callbackRef.current(now - startRef.current);
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
