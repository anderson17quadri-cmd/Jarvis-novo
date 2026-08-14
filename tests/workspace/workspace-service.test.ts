import { beforeEach, describe, expect, it } from 'vitest';

import { applyWorkspace, captureWorkspace, getWorkspaceStores } from '@/services/workspace-service';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import type { WindowRect } from '@/types/window';
import { normaliseSnapshot } from '@/types/workspace';

const RECT: WindowRect = { x: 0, y: 0, width: 500, height: 400 };
const rectFor = (): WindowRect => RECT;

beforeEach(async () => {
  localStorage.clear();
  useWindowStore.setState({ windows: [] });
  useThemeStore.setState({ theme: 'classic' });
  await useWidgetStore.getState().hydrate();
  await useAppearanceStore.getState().hydrate();
});

describe('capturar', () => {
  it('apanha janelas, widgets, tema e papel de parede', () => {
    useWindowStore.getState().open('emails', 'Emails', RECT);
    useThemeStore.setState({ theme: 'oled' });
    useAppearanceStore.getState().set('wallpaper', 'liso');

    const snapshot = captureWorkspace(getWorkspaceStores());

    expect(snapshot.windows.map((entry) => entry.appId)).toEqual(['emails']);
    expect(snapshot.theme).toBe('oled');
    expect(snapshot.ambience.wallpaper).toBe('liso');
    expect(snapshot.widgets.length).toBeGreaterThan(0);
  });

  it('guarda a geometria restaurada, não a maximizada', () => {
    const id = useWindowStore.getState().open('tasks', 'Tarefas', RECT);
    useWindowStore
      .getState()
      .toggleMaximize(id, { x: 0, y: 0, width: 1920, height: 1080 });

    const [entry] = captureWorkspace(getWorkspaceStores()).windows;
    expect(entry?.rect.width).toBe(RECT.width);
    expect(entry?.isMaximized).toBe(true);
  });
});

describe('aplicar', () => {
  it('fecha o que estava antes de abrir o que vem', () => {
    useWindowStore.getState().open('emails', 'Emails', RECT);
    const snapshot = captureWorkspace(getWorkspaceStores());

    useWindowStore.getState().open('tasks', 'Tarefas', RECT);
    applyWorkspace(snapshot, rectFor, getWorkspaceStores());

    expect(useWindowStore.getState().windows.map((window) => window.appId)).toEqual(['emails']);
  });

  it('repõe o tema e o papel de parede', () => {
    useThemeStore.setState({ theme: 'solar' });
    useAppearanceStore.getState().set('wallpaper', 'particulas');
    const snapshot = captureWorkspace(getWorkspaceStores());

    useThemeStore.getState().setTheme('classic');
    useAppearanceStore.getState().set('wallpaper', 'nebulosa');
    applyWorkspace(snapshot, rectFor, getWorkspaceStores());

    expect(useThemeStore.getState().theme).toBe('solar');
    expect(useAppearanceStore.getState().appearance.wallpaper).toBe('particulas');
  });

  it('repõe que widgets estavam à vista', () => {
    useWidgetStore.getState().hide('clock');
    const snapshot = captureWorkspace(getWorkspaceStores());

    useWidgetStore.getState().show('clock');
    applyWorkspace(snapshot, rectFor, getWorkspaceStores());

    expect(
      useWidgetStore.getState().widgets.find((widget) => widget.id === 'clock')?.isVisible,
    ).toBe(false);
  });

  it('um widget que já não exista no registo é descartado em vez de rebentar', () => {
    const snapshot = captureWorkspace(getWorkspaceStores());
    const corrupted = {
      ...snapshot,
      widgets: [
        ...snapshot.widgets,
        // Um widget de uma versão anterior.
        { id: 'gpu', placement: { col: 0, row: 0, colSpan: 3, rowSpan: 2 }, isVisible: true },
      ],
    } as typeof snapshot;

    applyWorkspace(corrupted, rectFor, getWorkspaceStores());

    // O widget desconhecido não entrou: ficaram os que o registo conhece.
    expect(useWidgetStore.getState().widgets).toHaveLength(snapshot.widgets.length);
  });

  it('um espaço de trabalho vazio deixa o ecrã sem janelas', () => {
    useWindowStore.getState().open('emails', 'Emails', RECT);

    applyWorkspace(
      normaliseSnapshot({ theme: 'classic' }),
      rectFor,
      getWorkspaceStores(),
    );

    expect(useWindowStore.getState().windows).toHaveLength(0);
  });

  it('repõe uma janela maximizada como maximizada', () => {
    const id = useWindowStore.getState().open('tasks', 'Tarefas', RECT);
    useWindowStore.getState().toggleMaximize(id, { x: 0, y: 0, width: 1920, height: 1040 });
    const snapshot = captureWorkspace(getWorkspaceStores());

    applyWorkspace(
      snapshot,
      rectFor,
      getWorkspaceStores(),
      'desktop',
      () => ({ x: 0, y: 0, width: 1920, height: 1040 }),
    );

    const [restored] = useWindowStore.getState().windows;
    expect(restored?.isMaximized).toBe(true);
  });

  it('não maximiza quando quem chama não dá geometria de maximizar', () => {
    const id = useWindowStore.getState().open('tasks', 'Tarefas', RECT);
    useWindowStore.getState().toggleMaximize(id, { x: 0, y: 0, width: 1920, height: 1040 });
    const snapshot = captureWorkspace(getWorkspaceStores());

    applyWorkspace(snapshot, rectFor, getWorkspaceStores(), 'desktop', () => null);

    const [restored] = useWindowStore.getState().windows;
    expect(restored?.isMaximized).toBe(false);
  });
});
