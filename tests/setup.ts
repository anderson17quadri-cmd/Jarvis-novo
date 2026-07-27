import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

/**
 * O jsdom não implementa `matchMedia`, e vários hooks dependem dele
 * (`pointer: coarse`, `prefers-reduced-motion`, breakpoints). O stub responde
 * sempre `false`, que corresponde ao desktop com movimento normal.
 *
 * É uma função normal e não um `vi.fn()` de propósito: um teste que chame
 * `vi.restoreAllMocks()` esvaziaria a implementação e deixaria os hooks a ler
 * `undefined.matches`.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/** O jsdom também não tem ResizeObserver — usado pelo AI Core e pelas janelas. */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
