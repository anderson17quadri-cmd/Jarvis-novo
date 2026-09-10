import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAnimationFrame } from '@/hooks/use-animation-frame';

/**
 * Ciclo de vida do `useAnimationFrame` (revisão a sério do núcleo visual,
 * 14/08/2026).
 *
 * Os testes de canvas não montam o hook, por isso não apanhavam dois defeitos
 * que só se veem ao renderizá-lo:
 *
 * 1. Com `prefers-reduced-motion`, o frame estático era desenhado uma única vez
 *    no arranque. Mudar de modo (ou de cor) não o redesenhava, e o canvas
 *    ficava preso no estado inicial para sempre — o núcleo não acompanhava a
 *    transição para "a analisar" ou "a responder".
 *
 * 2. Ao voltar do segundo plano, o `elapsed` recomeçava em 0. Um consumidor que
 *    calcula o delta entre frames (o `AICore`) via então um salto negativo de
 *    centenas de frames num só — partículas a andar para trás e ondas a ganhar
 *    brilho — porque o `Math.min(delta, 3)` só corta o limite de cima.
 */

const originalMatchMedia = window.matchMedia.bind(window);

/** matchMedia que liga só a query de movimento reduzido. */
function reducedMotionOn(): void {
  window.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
  delete (document as unknown as { hidden?: boolean }).hidden;
});

describe('useAnimationFrame — movimento reduzido', () => {
  it('redesenha o frame estático quando a callback muda', () => {
    reducedMotionOn();

    const primeiro = vi.fn<(elapsed: number) => void>();
    const segundo = vi.fn<(elapsed: number) => void>();

    const { rerender } = renderHook(
      ({ cb }: { cb: (elapsed: number) => void }) => useAnimationFrame(cb),
      { initialProps: { cb: primeiro } },
    );

    expect(primeiro).toHaveBeenCalledWith(0);

    // A callback muda quando o modo ou a cor do núcleo mudam. Sem o efeito
    // próprio, o frame estático não seria redesenhado.
    rerender({ cb: segundo });

    expect(segundo).toHaveBeenCalledWith(0);
  });
});

describe('useAnimationFrame — o tempo não recomeça ao voltar do segundo plano', () => {
  it('mantém o elapsed a crescer depois de um ciclo de visibilidade', () => {
    // rAF controlado à mão: cada `step` dispara um frame com um timestamp nosso.
    let time = 0;
    let nextId = 1;
    const pending = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      pending.delete(id);
    });
    const step = (ms: number): void => {
      time += ms;
      const queued = [...pending.values()];
      pending.clear();
      act(() => {
        for (const cb of queued) cb(time);
      });
    };

    const received: number[] = [];
    renderHook(() => useAnimationFrame((elapsed) => received.push(elapsed)));

    step(16); // arranque: elapsed 0
    step(16); // segundo frame: elapsed 16

    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    step(16); // devia ser 32 — não recomeçar em 0

    expect(received).toEqual([0, 16, 32]);
  });
});
