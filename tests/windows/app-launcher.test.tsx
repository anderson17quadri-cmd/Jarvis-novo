import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppLauncher } from '@/hooks/use-app-launcher';
import { useWindowStore } from '@/stores/use-window-store';

const RECT = { x: 100, y: 100, width: 400, height: 300 };

/** Monta o hook e restaura o layout ao arrancar, como o App faz. */
function Restorer(): null {
  const { restoreSavedLayout } = useAppLauncher();
  useEffect(() => {
    void restoreSavedLayout();
  }, [restoreSavedLayout]);
  return null;
}

beforeEach(() => {
  localStorage.clear();
  useWindowStore.setState({ windows: [], topZIndex: 50, cascadeOffset: 0 });
});

describe('useAppLauncher — restaurar layout guardado', () => {
  it('restaura uma janela guardada maximizada como maximizada', async () => {
    // Guardar uma janela maximizada, como o utilizador a deixou.
    const id = useWindowStore.getState().open('emails', 'Emails', RECT);
    useWindowStore.getState().toggleMaximize(id, { x: 0, y: 0, width: 1920, height: 1040 });
    await useWindowStore.getState().persistLayout();

    // Simular um arranque novo: sem janelas abertas.
    useWindowStore.setState({ windows: [] });

    render(<Restorer />);

    await waitFor(() => {
      const [window] = useWindowStore.getState().windows;
      expect(window?.appId).toBe('emails');
      expect(window?.isMaximized).toBe(true);
    });
  });

  it('restaura uma janela guardada normal como normal', async () => {
    useWindowStore.getState().open('emails', 'Emails', RECT);
    await useWindowStore.getState().persistLayout();
    useWindowStore.setState({ windows: [] });

    render(<Restorer />);

    await waitFor(() => {
      const [window] = useWindowStore.getState().windows;
      expect(window?.appId).toBe('emails');
      expect(window?.isMaximized).toBe(false);
    });
  });
});
