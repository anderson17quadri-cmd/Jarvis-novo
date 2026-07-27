import { beforeEach, describe, expect, it } from 'vitest';

import { useWindowStore } from '@/stores/use-window-store';
import { WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from '@/types/window';

const RECT = { x: 100, y: 100, width: 400, height: 300 };

describe('useWindowStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useWindowStore.setState({ windows: [], topZIndex: 50, cascadeOffset: 0 });
  });

  it('abre uma janela por aplicação e foca a existente em vez de duplicar', () => {
    const store = useWindowStore.getState();
    const first = store.open('assistant', 'Assistente', RECT);
    const second = useWindowStore.getState().open('assistant', 'Assistente', RECT);

    expect(first).toBe(second);
    expect(useWindowStore.getState().windows).toHaveLength(1);
  });

  it('desloca janelas seguidas em cascata, para não ficarem exatamente por cima', () => {
    const store = useWindowStore.getState();
    store.open('assistant', 'Assistente', RECT);
    useWindowStore.getState().open('calendar', 'Calendário', RECT);

    const [first, second] = useWindowStore.getState().windows;
    expect(second!.rect.x).toBeGreaterThan(first!.rect.x);
    expect(second!.rect.y).toBeGreaterThan(first!.rect.y);
  });

  it('focar traz a janela para a frente', () => {
    const store = useWindowStore.getState();
    const first = store.open('assistant', 'Assistente', RECT);
    useWindowStore.getState().open('calendar', 'Calendário', RECT);

    useWindowStore.getState().focus(first);
    const windows = useWindowStore.getState().windows;
    const focused = windows.find((w) => w.id === first);
    const other = windows.find((w) => w.id !== first);

    expect(focused!.zIndex).toBeGreaterThan(other!.zIndex);
  });

  it('focar a janela que já está à frente não gasta um z-index novo', () => {
    const store = useWindowStore.getState();
    const id = store.open('assistant', 'Assistente', RECT);
    const before = useWindowStore.getState().topZIndex;

    useWindowStore.getState().focus(id);
    expect(useWindowStore.getState().topZIndex).toBe(before);
  });

  it('maximizar guarda a geometria anterior e restaurar devolve-a', () => {
    const store = useWindowStore.getState();
    const id = store.open('system', 'Monitor', RECT);
    const maximized = { x: 88, y: 72, width: 1352, height: 738 };

    useWindowStore.getState().toggleMaximize(id, maximized);
    let window = useWindowStore.getState().windows[0]!;
    expect(window.isMaximized).toBe(true);
    expect(window.rect).toEqual(maximized);

    useWindowStore.getState().toggleMaximize(id, maximized);
    window = useWindowStore.getState().windows[0]!;
    expect(window.isMaximized).toBe(false);
    expect(window.rect.width).toBe(RECT.width);
    expect(window.restoreRect).toBeNull();
  });

  it('impõe o tamanho mínimo ao redimensionar', () => {
    const store = useWindowStore.getState();
    const id = store.open('themes', 'Personalização', RECT);

    useWindowStore.getState().resize(id, { width: 10, height: 10 });
    const { rect } = useWindowStore.getState().windows[0]!;

    expect(rect.width).toBe(WINDOW_MIN_WIDTH);
    expect(rect.height).toBe(WINDOW_MIN_HEIGHT);
  });

  it('minimizar mantém a janela no store, fechar remove-a', () => {
    const store = useWindowStore.getState();
    const id = store.open('assistant', 'Assistente', RECT);

    useWindowStore.getState().minimize(id);
    expect(useWindowStore.getState().windows[0]!.isMinimized).toBe(true);

    useWindowStore.getState().close(id);
    expect(useWindowStore.getState().windows).toHaveLength(0);
  });

  it('persiste a geometria restaurada, não a maximizada', async () => {
    const store = useWindowStore.getState();
    const id = store.open('system', 'Monitor', RECT);
    useWindowStore.getState().toggleMaximize(id, { x: 0, y: 0, width: 9999, height: 9999 });

    await useWindowStore.getState().persistLayout();
    const layout = await useWindowStore.getState().loadLayout();

    expect(layout).toHaveLength(1);
    // Guardar a geometria do ecrã inteiro daria uma janela fora do sítio ao
    // reabrir noutro monitor.
    expect(layout[0]!.rect.width).toBe(RECT.width);
    expect(layout[0]!.isMaximized).toBe(true);
  });
});
