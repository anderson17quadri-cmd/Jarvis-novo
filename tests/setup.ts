import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
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

/**
 * Nem `Element.scrollTo` — o painel de conversas usa-o para acompanhar a
 * resposta a ser escrita. Sem o stub, montar a janela do assistente rebenta.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo(): void {};
}

/**
 * Nem `URL.createObjectURL`/`revokeObjectURL` — usado para pré-visualizar
 * áudio da voz clonada e anexos de email. Um contador simples chega: nenhum
 * teste precisa de um blob a sério, só de uma string estável para comparar.
 */
if (typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  URL.createObjectURL = (): string => `blob:mock-${++counter}`;
  URL.revokeObjectURL = (): void => undefined;
}
