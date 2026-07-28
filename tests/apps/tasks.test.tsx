import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import TasksWindow from '@/apps/tasks/TasksWindow';
import { useTaskStore } from '@/stores/use-task-store';

beforeEach(async () => {
  localStorage.clear();
  useTaskStore.setState({ tasks: [], isHydrated: false });
});

/**
 * A leitura do armazenamento é assíncrona. Fazê-la antes de montar mantém o
 * React fora de atualizações que não vê — a janela hidratar-se sozinha tem
 * teste próprio, mais abaixo.
 */
async function renderTasks(): Promise<void> {
  await useTaskStore.getState().hydrate();
  render(<TasksWindow />);
}

describe('janela de Tarefas', () => {
  it('abre nas abertas, e as concluídas ficam de fora', async () => {
    await renderTasks();

    expect(screen.getByText('Preparar a demonstração para a Barbearia Silva')).toBeInTheDocument();
    expect(screen.queryByText('Migrar os tokens de cor para o design system')).toBeNull();
  });

  it('a atrasada aparece marcada como tal', async () => {
    await renderTasks();

    const row = screen
      .getByText('Fechar o orçamento do fornecedor de hardware')
      .closest('li');
    expect(within(row!).getByText(/atrasada/i)).toBeInTheDocument();
  });

  it('as de prioridade alta vêm à frente', async () => {
    await renderTasks();

    const titles = screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'));
    expect(titles[0]).toBe('Fechar o orçamento do fornecedor de hardware');
  });

  it('juntar uma tarefa põe-na na lista e guarda-a', async () => {
    const user = userEvent.setup();
    await renderTasks();

    await user.type(screen.getByLabelText('Nova tarefa'), 'Ligar ao contabilista');
    await user.click(screen.getByRole('button', { name: /acrescentar tarefa/i }));

    expect(screen.getByText('Ligar ao contabilista')).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem('jarvis.tasks')).toContain('Ligar ao contabilista');
    });
  });

  it('uma tarefa vazia não entra', async () => {
    const user = userEvent.setup();
    await renderTasks();
    const before = useTaskStore.getState().tasks.length;

    await user.type(screen.getByLabelText('Nova tarefa'), '   ');
    await user.click(screen.getByRole('button', { name: /acrescentar tarefa/i }));

    expect(useTaskStore.getState().tasks).toHaveLength(before);
  });

  it('marcar como feita tira-a das abertas', async () => {
    const user = userEvent.setup();
    await renderTasks();

    await user.click(screen.getByRole('checkbox', { name: 'Responder à Voxel Studio sobre a remarcação' }));

    expect(screen.queryByText('Responder à Voxel Studio sobre a remarcação')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Concluídas \(/i }));
    expect(screen.getByText('Responder à Voxel Studio sobre a remarcação')).toBeInTheDocument();
  });

  it('marcar uma subtarefa move a barra de progresso', async () => {
    const user = userEvent.setup();
    await renderTasks();

    const bar = screen.getByRole('progressbar', {
      name: /progresso de preparar a demonstração/i,
    });
    expect(bar).toHaveAttribute('aria-valuenow', '67');

    await user.click(screen.getByRole('checkbox', { name: 'Ensaio cronometrado' }));

    expect(
      screen.getByRole('progressbar', { name: /progresso de preparar a demonstração/i }),
    ).toHaveAttribute('aria-valuenow', '100');
  });

  it('apagar tira a tarefa de vez', async () => {
    const user = userEvent.setup();
    await renderTasks();

    await user.click(screen.getByRole('button', { name: /apagar: escrever as notas/i }));

    expect(screen.queryByText('Escrever as notas da versão 1.0')).toBeNull();
  });
});
