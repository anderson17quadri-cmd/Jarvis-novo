import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { LayoutSettings } from '@/apps/personalization/LayoutSettings';
import { DesktopSwitcher } from '@/components/shell/DesktopSwitcher';
import { builtInLayouts } from '@/data/layouts';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { defaultDesktops } from '@/types/workspace';

beforeEach(async () => {
  localStorage.clear();
  useWorkspaceStore.setState({
    desktops: defaultDesktops(),
    current: 1,
    layouts: builtInLayouts(),
  });
  useWindowStore.setState({ windows: [] });
  useThemeStore.setState({ theme: 'classic' });
  await useWidgetStore.getState().hydrate();
});

describe('seletor de desktops', () => {
  it('mostra os quatro, com o atual marcado', () => {
    render(<DesktopSwitcher />);

    const group = screen.getByRole('group', { name: 'Desktops' });
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByLabelText('Desktop 1 (atual)')).toBeInTheDocument();
  });

  it('carregar num muda de desktop', async () => {
    const user = userEvent.setup();
    render(<DesktopSwitcher />);

    await user.click(screen.getByLabelText('Desktop 3'));

    expect(useWorkspaceStore.getState().current).toBe(3);
    expect(screen.getByLabelText('Desktop 3 (atual)')).toBeInTheDocument();
  });

  it('ir e voltar repõe as janelas que lá estavam', async () => {
    useWindowStore.getState().open('emails', 'Emails', { x: 0, y: 0, width: 400, height: 300 });

    const user = userEvent.setup();
    render(<DesktopSwitcher />);

    await user.click(screen.getByLabelText('Desktop 2'));
    // O desktop 2 nunca foi visitado: herda o ecrã. Limpa-se para se ver que o
    // regresso repõe mesmo o que estava no primeiro.
    useWindowStore.setState({ windows: [] });

    await user.click(screen.getByLabelText('Desktop 1'));

    await waitFor(() => {
      expect(useWindowStore.getState().windows.map((window) => window.appId)).toEqual(['emails']);
    });
  });
});

describe('layouts guardados', () => {
  it('lista os seis do sistema', () => {
    render(<LayoutSettings />);

    for (const layout of builtInLayouts()) {
      expect(screen.getByText(layout.name)).toBeInTheDocument();
    }
  });

  it('sem nenhum guardado, explica como se guarda', () => {
    render(<LayoutSettings />);
    expect(screen.getByRole('button', { name: /Guardar o atual/ })).toBeInTheDocument();
    expect(screen.getByText(/Nenhum ainda/)).toBeInTheDocument();
  });

  it('aplicar um layout abre as janelas e muda o tema', async () => {
    const user = userEvent.setup();
    render(<LayoutSettings />);

    await user.click(screen.getByText('Programação'));

    await waitFor(() => {
      expect(useThemeStore.getState().theme).toBe('graphite');
    });
    expect(useWindowStore.getState().windows.map((window) => window.appId)).toEqual([
      'projects',
      'files',
    ]);
  });

  it('guardar o estado atual cria um layout com o nome escrito', async () => {
    useWindowStore.getState().open('tasks', 'Tarefas', { x: 0, y: 0, width: 400, height: 300 });

    const user = userEvent.setup();
    render(<LayoutSettings />);

    await user.type(screen.getByLabelText('Nome do layout a guardar'), 'Manhã');
    await user.click(screen.getByRole('button', { name: /Guardar o atual/ }));

    expect(await screen.findByText('Manhã')).toBeInTheDocument();
    expect(
      useWorkspaceStore.getState().layouts.find((layout) => layout.name === 'Manhã')?.snapshot
        .windows,
    ).toHaveLength(1);
  });

  it('os do sistema não têm botão de apagar; os meus têm', async () => {
    const user = userEvent.setup();
    render(<LayoutSettings />);

    expect(screen.queryByLabelText('Apagar o layout Produtividade')).toBeNull();

    await user.type(screen.getByLabelText('Nome do layout a guardar'), 'Manhã');
    await user.click(screen.getByRole('button', { name: /Guardar o atual/ }));

    const remove = await screen.findByLabelText('Apagar o layout Manhã');
    await user.click(remove);

    expect(screen.queryByText('Manhã')).toBeNull();
  });
});
