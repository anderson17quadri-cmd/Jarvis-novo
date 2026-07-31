import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeEditor } from '@/apps/personalization/ThemeEditor';
import { themeService } from '@/services/theme-service';
import { useCustomThemeStore } from '@/stores/use-custom-theme-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { deriveOverrides } from '@/types/custom-theme';

beforeEach(() => {
  localStorage.clear();
  useCustomThemeStore.setState({ themes: [] });
  useThemeStore.setState({ theme: 'classic' });
  themeService.apply('classic');
});

/** Cria um tema pelo editor, como o utilizador o faria. */
async function createTheme(name: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Nome do tema'), name);
  await user.click(screen.getByRole('button', { name: /Criar tema/ }));
}

describe('criar', () => {
  it('guarda o tema e aplica-o de imediato', async () => {
    render(<ThemeEditor />);
    await createTheme('O meu azul');

    await waitFor(() => {
      expect(useCustomThemeStore.getState().themes).toHaveLength(1);
    });

    const [created] = useCustomThemeStore.getState().themes;
    expect(created?.name).toBe('O meu azul');
    expect(useThemeStore.getState().theme).toBe(created?.id);
  });

  it('um tema sem nome ainda fica com um', async () => {
    render(<ThemeEditor />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Criar tema/ }));

    await waitFor(() => {
      expect(useCustomThemeStore.getState().themes[0]?.name).toBe('Tema sem nome');
    });
  });

  it('o identificador não pode colidir com um tema oficial', async () => {
    render(<ThemeEditor />);
    await createTheme('Meu');

    await waitFor(() => {
      expect(useCustomThemeStore.getState().themes[0]?.id).toMatch(/^custom:/);
    });
  });

  it('limpa o nome mas guarda as cores, para a amostra não mentir', async () => {
    render(<ThemeEditor />);
    fireEvent.change(screen.getByLabelText('Acento'), { target: { value: '#ffb020' } });
    await createTheme('Primeiro');

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nome do tema')).toHaveValue('');
    });
    // A pré-visualização voltar ao azul enquanto o sistema está âmbar seria
    // mostrar uma coisa e aplicar outra.
    expect(screen.getByLabelText('Acento')).toHaveValue('#ffb020');
  });
});

describe('pré-visualização e aviso', () => {
  it('mostra o contraste do texto sobre o fundo', () => {
    render(<ThemeEditor />);
    expect(screen.getByLabelText('Pré-visualização do tema')).toBeInTheDocument();
    expect(screen.getByText(/contraste \d+\.\d:1/)).toBeInTheDocument();
  });

  it('escolher um fundo claro passa a base a clara sozinho', async () => {
    render(<ThemeEditor />);

    // `<input type="color">` não se escreve — muda-se de uma vez, que é o que
    // um seletor de cor do sistema faz.
    fireEvent.change(screen.getByLabelText('Fundo'), { target: { value: '#ffffff' } });

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Clara' })).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('avisa quando o resultado não se lê, mas deixa criar na mesma', async () => {
    const user = userEvent.setup();
    render(<ThemeEditor />);

    // Base escura à força sobre um fundo branco: texto branco sobre branco.
    fireEvent.change(screen.getByLabelText('Fundo'), { target: { value: '#ffffff' } });
    await user.click(screen.getByRole('radio', { name: 'Escura' }));

    expect(await screen.findByText(/não contrasta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar tema/ })).toBeEnabled();
  });
});

describe('gerir', () => {
  it('aplicar escreve mesmo as variáveis no documento', async () => {
    render(<ThemeEditor />);
    await createTheme('Meu');

    await waitFor(() => {
      expect(document.documentElement.dataset['theme']).toBe('custom');
    });

    const [created] = useCustomThemeStore.getState().themes;
    const expected = deriveOverrides(created!);
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(expected.accent);
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(expected.bg);
  });

  it('voltar a um oficial limpa o que o personalizado tinha escrito', async () => {
    render(<ThemeEditor />);
    await createTheme('Meu');
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--bg')).not.toBe(''));

    useThemeStore.getState().setTheme('oled');

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
    expect(document.documentElement.dataset['theme']).toBe('oled');
  });

  it('apagar o tema em vigor volta ao base, em vez de deixar cores órfãs', async () => {
    const user = userEvent.setup();
    render(<ThemeEditor />);
    await createTheme('Meu');

    await user.click(await screen.findByLabelText('Apagar o tema Meu'));

    expect(useCustomThemeStore.getState().themes).toHaveLength(0);
    expect(useThemeStore.getState().theme).toBe('classic');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
  });

  it('sobrevive a recarregar, e volta a ser aplicado', async () => {
    render(<ThemeEditor />);
    await createTheme('Meu');
    await waitFor(() => expect(useCustomThemeStore.getState().themes).toHaveLength(1));

    const id = useCustomThemeStore.getState().themes[0]!.id;
    await useCustomThemeStore.getState().persist();

    useCustomThemeStore.setState({ themes: [] });
    useThemeStore.setState({ theme: 'classic' });
    await useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe(id);
    expect(document.documentElement.dataset['theme']).toBe('custom');
  });

  it('um tema apagado noutra sessão não deixa o sistema sem cores', async () => {
    localStorage.setItem('jarvis.theme', JSON.stringify('custom:desaparecido'));
    await useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe('classic');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });
});
