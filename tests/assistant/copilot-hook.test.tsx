import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCopilot } from '@/hooks/use-copilot';
import { copilot } from '@/services/assistant/copilot';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { useTaskStore } from '@/stores/use-task-store';
import { useWindowStore } from '@/stores/use-window-store';

/**
 * O hook do copiloto.
 *
 * As regras já se testam com números. Isto testa o que os números não veem: se
 * a lista **volta a ser calculada** quando alguma coisa muda.
 */

/** Seis janelas de aplicações diferentes — abrir a mesma duas vezes só a traz à frente. */
function abrirSeisJanelas(): void {
  const apps = ['emails', 'tasks', 'projects', 'files', 'calendar', 'themes'] as const;

  for (const app of apps) {
    useWindowStore.getState().open(app, app, { x: 0, y: 0, width: 300, height: 200 });
  }
}

function Sonda(): React.JSX.Element {
  const { suggestions, dismiss } = useCopilot();

  return (
    <div>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <span>{suggestion.fact}</span>
            <button type="button" onClick={() => dismiss(suggestion.id)}>
              dispensar {suggestion.id}
            </button>
          </li>
        ))}
      </ul>
      <p data-testid="total">{suggestions.length}</p>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  copilot.reset();
  useWindowStore.setState({ windows: [] });
  useSystemStateStore.setState({ current: 'normal' });
  useTaskStore.setState({ tasks: [] });
});

describe('useCopilot', () => {
  it('sem factos, não mostra nada', () => {
    render(<Sonda />);

    expect(screen.getByTestId('total')).toHaveTextContent('0');
  });

  it('abrir janelas até ao limite faz aparecer a sugestão', async () => {
    render(<Sonda />);

    abrirSeisJanelas();

    expect(await screen.findByText('6 janelas abertas.')).toBeInTheDocument();
  });

  it('**dispensar tira a sugestão do ecrã**, sem mais nada mudar no sistema', async () => {
    render(<Sonda />);

    abrirSeisJanelas();

    await screen.findByText('6 janelas abertas.');

    fireEvent.click(screen.getByRole('button', { name: 'dispensar muitas-janelas' }));

    /*
     * Este é o caso que faltava.
     *
     * A lista era recalculada por um `useMemo` que não dependia das
     * dispensadas: o React voltava a desenhar, o memo devolvia a lista antiga,
     * e o botão parecia não fazer nada. Ao **aceitar** não se via, porque a
     * ação mudava o sistema e isso recalculava a lista por outra via.
     */
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('0'));
  });

  it('passar ao modo foco cala a sugestão das janelas', async () => {
    render(<Sonda />);

    abrirSeisJanelas();

    await screen.findByText('6 janelas abertas.');

    useSystemStateStore.setState({ current: 'foco' });

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('0'));
  });
});
