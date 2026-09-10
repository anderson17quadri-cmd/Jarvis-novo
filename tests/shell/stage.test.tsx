import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { Stage } from '@/components/shell/Stage';
import { useWidgetStore } from '@/stores/use-widget-store';

/**
 * O núcleo é o elemento principal do ambiente de trabalho (Partes 6.1 e 8).
 *
 * Isto guarda um erro que já aconteceu: a grelha de widgets passou a ser
 * desenhada por cima do núcleo, com ele a 18% de opacidade por trás de cartões
 * opacos. Resultado — no telemóvel o núcleo deixou de se ver de todo, e o
 * sistema passou a parecer uma lista de widgets.
 */

function Nucleo(): React.JSX.Element {
  return <div data-testid="nucleo">núcleo</div>;
}

beforeEach(() => {
  localStorage.clear();
  useWidgetStore.getState().reset();
});

describe('palco', () => {
  it('desenha o núcleo antes dos widgets', () => {
    const { container } = render(
      <Stage>
        <Nucleo />
      </Stage>,
    );

    const core = screen.getByTestId('nucleo');
    const grid = container.querySelector('[aria-label*="Widgets"]');
    expect(grid).not.toBeNull();

    // `DOCUMENT_POSITION_FOLLOWING` = a grelha vem depois do núcleo.
    expect(core.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('não esbate o núcleo por haver widgets', () => {
    const { container } = render(
      <Stage>
        <Nucleo />
      </Stage>,
    );

    // A opacidade reduzida era o que o tornava invisível atrás dos cartões.
    let element: HTMLElement | null = screen.getByTestId('nucleo');
    while (element && element !== container) {
      expect(element.className).not.toMatch(/opacity-\[?\.?\d/);
      element = element.parentElement;
    }
  });

  it('o núcleo continua no palco quando não há widget nenhum', () => {
    for (const widget of useWidgetStore.getState().widgets) {
      useWidgetStore.getState().hide(widget.id);
    }

    const { container } = render(
      <Stage>
        <Nucleo />
      </Stage>,
    );

    expect(screen.getByTestId('nucleo')).toBeInTheDocument();
    // Sem widgets não há grelha nenhuma a montar — o palco é só o núcleo.
    expect(container.querySelector('[aria-label*="Widgets"]')).toBeNull();
  });

  it('o núcleo e a etiqueta de estado empilham-se, não competem pela largura', () => {
    const { container } = render(
      <Stage>
        <Nucleo />
      </Stage>,
    );

    const wrapper = screen.getByTestId('nucleo').parentElement;
    expect(wrapper?.className).toContain('flex-col');
    expect(container).toBeTruthy();
  });
});
