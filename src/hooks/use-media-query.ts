import { useSyncExternalStore } from 'react';

import { BREAKPOINTS } from '@/design-system/tokens';

/**
 * Subscreve uma media query.
 *
 * Usa `useSyncExternalStore` em vez de `useState` + `useEffect` para não haver
 * um frame com o valor errado no primeiro render — o que, num shell que muda de
 * rail para gaveta, dava um salto visível.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };

  const getSnapshot = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * `true` abaixo dos 820px: o rail vira gaveta, as janelas empilham-se e o dock
 * ganha scroll horizontal. É o mesmo ponto de quebra do protótipo.
 */
export function useIsCompact(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.compact}px)`);
}

/** `true` abaixo dos 520px — telemóvel apertado. */
export function useIsTight(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.tight}px)`);
}

/** `true` em ecrãs de toque. */
export function useIsCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * `true` quando o utilizador pediu menos movimento.
 *
 * Respeitado a sério: além do CSS cortar transições, os componentes de canvas
 * leem isto para reduzir partículas ou parar o loop por completo.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
