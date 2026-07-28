import { beforeEach, describe, expect, it } from 'vitest';

import { builtInLayouts } from '@/data/layouts';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { selectCurrentDesktop, useWorkspaceStore } from '@/stores/use-workspace-store';
import { defaultDesktops } from '@/types/workspace';

beforeEach(async () => {
  localStorage.clear();
  useWorkspaceStore.setState({
    desktops: defaultDesktops(),
    current: 1,
    layouts: builtInLayouts(),
  });
  useWindowStore.setState({ windows: [] });
  await useWidgetStore.getState().hydrate();
});

/** Abre uma janela a sério, para haver alguma coisa que valha a pena guardar. */
function openWindow(appId: 'emails' | 'tasks'): void {
  useWindowStore
    .getState()
    .open(appId, appId, { x: 10, y: 20, width: 400, height: 300 });
}

describe('desktops', () => {
  it('começa no primeiro, com quatro disponíveis', () => {
    expect(useWorkspaceStore.getState().current).toBe(1);
    expect(useWorkspaceStore.getState().desktops).toHaveLength(4);
  });

  it('mudar guarda o que estava no desktop de onde se sai', () => {
    openWindow('emails');
    useWorkspaceStore.getState().switchTo(2);

    const first = useWorkspaceStore.getState().desktops.find((desktop) => desktop.id === 1);
    expect(first?.snapshot?.windows.map((entry) => entry.appId)).toEqual(['emails']);
  });

  it('um desktop por estrear não devolve fotografia nenhuma — herda o que está no ecrã', () => {
    openWindow('emails');
    expect(useWorkspaceStore.getState().switchTo(3)).toBeNull();
  });

  it('voltar a um desktop já visitado devolve o que lá estava', () => {
    openWindow('emails');
    useWorkspaceStore.getState().switchTo(2);

    useWindowStore.setState({ windows: [] });
    openWindow('tasks');
    const back = useWorkspaceStore.getState().switchTo(1);

    expect(back?.windows.map((entry) => entry.appId)).toEqual(['emails']);
  });

  it('mudar para o desktop onde já se está não faz nada', () => {
    expect(useWorkspaceStore.getState().switchTo(1)).toBeNull();
  });

  it('guardar o estado atual não muda de desktop', () => {
    openWindow('emails');
    useWorkspaceStore.getState().syncCurrent();

    expect(useWorkspaceStore.getState().current).toBe(1);
    expect(selectCurrentDesktop(useWorkspaceStore.getState()).snapshot?.windows).toHaveLength(1);
  });

  it('renomear guarda o nome, mas um nome em branco não', () => {
    useWorkspaceStore.getState().renameDesktop(2, '  Trabalho  ');
    expect(useWorkspaceStore.getState().desktops[1]?.name).toBe('Trabalho');

    useWorkspaceStore.getState().renameDesktop(2, '   ');
    expect(useWorkspaceStore.getState().desktops[1]?.name).toBe('Trabalho');
  });
});

describe('layouts', () => {
  it('os seis do sistema estão lá desde o início', () => {
    const names = useWorkspaceStore
      .getState()
      .layouts.filter((layout) => layout.isBuiltIn)
      .map((layout) => layout.name);

    expect(names).toEqual([
      'Produtividade',
      'Programação',
      'Design',
      'Estudos',
      'Streaming',
      'Jogos',
    ]);
  });

  it('guardar apanha as janelas, os widgets e o tema do momento', () => {
    openWindow('tasks');
    useThemeStore.setState({ theme: 'emerald' });

    const saved = useWorkspaceStore.getState().saveLayout('O meu');

    expect(saved.snapshot.windows.map((entry) => entry.appId)).toEqual(['tasks']);
    expect(saved.snapshot.theme).toBe('emerald');
    expect(saved.snapshot.widgets.length).toBeGreaterThan(0);
  });

  it('um layout sem nome ainda fica com um', () => {
    expect(useWorkspaceStore.getState().saveLayout('   ').name).toBe('Layout sem nome');
  });

  it('apagar tira o do utilizador', () => {
    const saved = useWorkspaceStore.getState().saveLayout('O meu');
    useWorkspaceStore.getState().removeLayout(saved.id);

    expect(useWorkspaceStore.getState().getLayout(saved.id)).toBeNull();
  });

  it('os do sistema não se apagam — voltariam no arranque seguinte', () => {
    useWorkspaceStore.getState().removeLayout('produtividade');
    expect(useWorkspaceStore.getState().getLayout('produtividade')).not.toBeNull();
  });
});

describe('persistência', () => {
  it('os desktops e os layouts do utilizador sobrevivem a recarregar', async () => {
    openWindow('emails');
    useWorkspaceStore.getState().switchTo(2);
    useWorkspaceStore.getState().saveLayout('O meu');
    await useWorkspaceStore.getState().persist();

    useWorkspaceStore.setState({ desktops: defaultDesktops(), current: 1, layouts: [] });
    await useWorkspaceStore.getState().hydrate();

    const state = useWorkspaceStore.getState();
    expect(state.current).toBe(2);
    expect(state.desktops[0]?.snapshot?.windows).toHaveLength(1);
    expect(state.layouts.some((layout) => layout.name === 'O meu')).toBe(true);
  });

  it('os do sistema vêm sempre do código, para uma correção chegar a quem já os tinha', async () => {
    await useWorkspaceStore.getState().persist();
    useWorkspaceStore.setState({ layouts: [] });
    await useWorkspaceStore.getState().hydrate();

    expect(useWorkspaceStore.getState().layouts.filter((layout) => layout.isBuiltIn)).toHaveLength(
      6,
    );
  });

  it('sem nada gravado fica no estado inicial', async () => {
    await useWorkspaceStore.getState().hydrate();

    expect(useWorkspaceStore.getState().current).toBe(1);
    expect(useWorkspaceStore.getState().desktops).toHaveLength(4);
  });
});
