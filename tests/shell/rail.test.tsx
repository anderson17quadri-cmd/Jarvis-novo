import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Rail } from '@/components/shell/Rail';

/**
 * A gaveta do compacto tem de ficar **acima** do scrim.
 *
 * Já esteve por baixo: havia `z-rail` na base do `className` e `z-drawer` no
 * ramo compacto. São classes diferentes para a mesma propriedade, e o
 * `tailwind-merge` não as junta por serem chaves próprias — ficavam as duas, e
 * quem decidia era a ordem no CSS gerado. Ganhava o `z-rail` (35), abaixo do
 * scrim (46): abrir a gaveta escurecia e desfocava o ecrã inteiro, e não se
 * via nada.
 */

function setViewport(width: number): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    return {
      matches: max ? width <= Number(max[1]) : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  };
}

function renderRail(width: number, isDrawerOpen: boolean): HTMLElement {
  setViewport(width);
  const { container } = render(
    <Rail
      isVisible
      isDrawerOpen={isDrawerOpen}
      activeId="dashboard"
      onSelect={vi.fn()}
      onCloseDrawer={vi.fn()}
    />,
  );

  // Consultado pelo elemento e não pelo papel: com a gaveta fechada o `nav`
  // leva `aria-hidden`, e é isso mesmo que se quer verificar.
  const nav = container.querySelector('nav');
  if (!nav) throw new Error('O rail não foi desenhado.');
  return nav;
}

beforeEach(() => {
  setViewport(1500);
});

describe('rail e gaveta', () => {
  it('no compacto a gaveta leva `z-drawer` e nunca `z-rail`', () => {
    const nav = renderRail(393, true);

    expect(nav.className).toContain('z-drawer');
    // Duas classes de z-index deixariam a decisão à ordem do CSS gerado.
    expect(nav.className).not.toContain('z-rail');
  });

  it('no desktop leva `z-rail` e nunca `z-drawer`', () => {
    const nav = renderRail(1500, false);

    expect(nav.className).toContain('z-rail');
    expect(nav.className).not.toContain('z-drawer');
  });

  it('a gaveta fechada fica fora do ecrã e escondida dos leitores', () => {
    const nav = renderRail(393, false);

    expect(nav.className).toContain('-translate-x-full');
    expect(nav).toHaveAttribute('aria-hidden', 'true');
  });

  it('a gaveta aberta entra e deixa de estar escondida', () => {
    const nav = renderRail(393, true);

    expect(nav.className).toContain('translate-x-0');
    expect(nav).toHaveAttribute('aria-hidden', 'false');
  });
});
