import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PersonalizationWindow from '@/apps/personalization/PersonalizationWindow';
import { THEMES } from '@/design-system/tokens';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { useThemeStore } from '@/stores/use-theme-store';

/**
 * O jsdom não implementa `location.reload` — chamá-lo lança "Not implemented".
 * Substituímo-lo para poder verificar que foi pedido um recarregamento.
 */
const reload = vi.fn();

beforeEach(() => {
  localStorage.clear();
  reload.mockClear();
  useThemeStore.setState({ theme: 'classic' });
  delete document.documentElement.dataset['theme'];

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

/** O grupo dos temas, distinto do grupo dos estados do sistema. */
function themeGroup(): HTMLElement {
  return screen.getByRole('radiogroup', { name: 'Temas do sistema' });
}

describe('janela de Personalização', () => {
  it('mostra os dez temas oficiais', () => {
    render(<PersonalizationWindow />);

    for (const theme of THEMES) {
      expect(screen.getByRole('radio', { name: new RegExp(theme.name, 'i') })).toBeInTheDocument();
    }
    // Só os do grupo dos temas: a janela tem outro grupo, o dos estados.
    expect(within(themeGroup()).getAllByRole('radio')).toHaveLength(THEMES.length);
  });

  it('marca o tema em vigor e só esse', () => {
    useThemeStore.setState({ theme: 'emerald' });
    render(<PersonalizationWindow />);

    const checked = within(themeGroup())
      .getAllByRole('radio')
      .filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName(/emerald/i);
  });

  it('trocar de tema escreve no DOM e no store', async () => {
    const user = userEvent.setup();
    render(<PersonalizationWindow />);

    await user.click(screen.getByRole('radio', { name: /solar/i }));

    expect(useThemeStore.getState().theme).toBe('solar');
    expect(document.documentElement.dataset['theme']).toBe('solar');
  });

  it('voltar ao tema base remove o atributo em vez de o pôr a "classic"', async () => {
    const user = userEvent.setup();
    useThemeStore.setState({ theme: 'oled' });
    render(<PersonalizationWindow />);

    await user.click(screen.getByRole('radio', { name: /jarvis classic/i }));

    // O Classic é o `:root`; um `data-theme="classic"` sem regra CSS seria ruído.
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  describe('repor a sequência de arranque (Parte 4 §Pular boot)', () => {
    it('oferece o botão nas configurações, e não só na Command Palette', () => {
      render(<PersonalizationWindow />);
      expect(
        screen.getByRole('button', { name: /mostrar sequência completa de arranque/i }),
      ).toBeInTheDocument();
    });

    it('limpa a marca de arranque e pede recarregamento', async () => {
      const user = userEvent.setup();
      await storageService.set(STORAGE_KEYS.booted, true);

      render(<PersonalizationWindow />);
      await user.click(
        screen.getByRole('button', { name: /mostrar sequência completa de arranque/i }),
      );

      await waitFor(async () => {
        await expect(storageService.get(STORAGE_KEYS.booted, true)).resolves.toBe(false);
      });
      await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    });
  });
});
