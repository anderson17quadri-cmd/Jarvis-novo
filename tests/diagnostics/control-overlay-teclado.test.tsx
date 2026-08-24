import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ControlOverlay } from '@/components/ControlOverlay';

/**
 * O overlay é o modal mais crítico da aplicação — o que pergunta se o JARVIS
 * pode mexer no computador. Era o único dos quatro `aria-modal` que não
 * mexia no foco: ficava onde estava, atrás do overlay, e um Enter reflexo
 * carregava num botão escondido.
 */
describe('ControlOverlay — teclado', () => {
  it('foca o Recusar ao abrir, nunca o Confirmar', async () => {
    render(
      <ControlOverlay
        stepDescription="Abrir a calculadora"
        stepRisk="medio"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /recusar/i })).toHaveFocus();
    });
  });

  it('Escape recusa o passo', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ControlOverlay
        stepDescription="Abrir a calculadora"
        stepRisk="medio"
        onConfirm={() => undefined}
        onCancel={onCancel}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
