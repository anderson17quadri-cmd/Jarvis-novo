import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ProjectsWindow from '@/apps/projects/ProjectsWindow';
import { seedProjects } from '@/data/projects';

describe('janela de Projetos', () => {
  it('lista todos os projetos', () => {
    render(<ProjectsWindow />);

    for (const project of seedProjects()) {
      expect(screen.getByText(project.name)).toBeInTheDocument();
    }
  });

  it('o progresso é anunciado, não só desenhado', () => {
    render(<ProjectsWindow />);

    expect(screen.getByRole('progressbar', { name: /progresso de agendado/i })).toHaveAttribute(
      'aria-valuenow',
      '72',
    );
  });

  it('filtrar por estado mostra só esses', async () => {
    const user = userEvent.setup();
    render(<ProjectsWindow />);

    await user.click(screen.getByRole('button', { name: 'Pausado' }));

    expect(screen.getByText('Voxel Studio — site')).toBeInTheDocument();
    expect(screen.queryByText('Agendado')).toBeNull();
  });

  it('um estado sem projetos explica-se em vez de ficar em branco', async () => {
    const user = userEvent.setup();
    render(<ProjectsWindow />);

    await user.click(screen.getByRole('button', { name: 'Pausado' }));
    await user.click(screen.getByRole('button', { name: 'Concluído' }));
    await user.click(screen.getByRole('button', { name: 'Todos' }));

    // Com os quatro visíveis, nenhuma mensagem de vazio.
    expect(screen.queryByText(/nenhum projeto neste estado/i)).toBeNull();
  });

  it('mostra há quanto tempo cada um foi tocado', () => {
    render(<ProjectsWindow />);

    // O JARVIS foi atualizado há 40 minutos na semente.
    expect(screen.getByText('há 40 min')).toBeInTheDocument();
  });
});
