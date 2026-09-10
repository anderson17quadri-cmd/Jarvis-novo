import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import PluginManagerWindow from '@/apps/plugin-manager/PluginManagerWindow';
import { MARKETPLACE_LISTINGS } from '@/apps/plugin-manager/marketplace-sample-data';
import { usePluginStore } from '@/stores/use-plugin-store';

beforeEach(async () => {
  localStorage.clear();
  await usePluginStore.getState().hydrate();
});

/**
 * Esboço do Marketplace (Parte 11) — dados de exemplo, nunca instaláveis.
 * O que se testa aqui é exatamente isso: aparece, é claramente rotulado
 * como esboço, e "Instalar" nunca funciona.
 */
describe('Marketplace — esboço', () => {
  it('lista todas as entradas de exemplo', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('tab', { name: 'Marketplace' }));

    for (const listing of MARKETPLACE_LISTINGS) {
      expect(screen.getByText(listing.name)).toBeInTheDocument();
    }
  });

  it('diz de frente que são dados de exemplo, sem fonte real', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('tab', { name: 'Marketplace' }));

    expect(screen.getByText(/dados de exemplo, escritos à mão/i)).toBeInTheDocument();
  });

  it('nenhum botão Instalar funciona', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('tab', { name: 'Marketplace' }));

    const botoes = screen.getAllByRole('button', { name: 'Instalar' });
    expect(botoes.length).toBe(MARKETPLACE_LISTINGS.length);
    for (const botao of botoes) expect(botao).toBeDisabled();
  });

  it('não instala nada de verdade, mesmo que se tente', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('tab', { name: 'Marketplace' }));
    const antes = usePluginStore.getState().installed;

    // Um botão desativado nem dispara o clique — confirma-se o estado do
    // store não muda, que é a garantia que interessa a sério.
    expect(usePluginStore.getState().installed).toBe(antes);
  });

  it('a aba Marketplace não tem pesquisa nem filtro de categorias', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('tab', { name: 'Marketplace' }));

    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Categorias' })).toBeNull();
  });
});
