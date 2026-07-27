import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import PluginManagerWindow from '@/apps/plugin-manager/PluginManagerWindow';
import {
  missingCapabilities,
  PLUGIN_CATALOG,
  type CatalogEntry,
} from '@/apps/plugin-manager/plugin-catalog';
import { getPlatformAdapter } from '@/platform';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useNotificationStore } from '@/stores/use-notification-store';

/** O primeiro plugin do catálogo que funciona nesta plataforma e não é do sistema. */
function firstInstallable(): CatalogEntry {
  const capabilities = getPlatformAdapter().capabilities;
  const entry = PLUGIN_CATALOG.find(
    (candidate) => !candidate.isBuiltIn && missingCapabilities(candidate, capabilities).length === 0,
  );
  if (!entry) throw new Error('O catálogo tem de ter pelo menos um plugin instalável.');
  return entry;
}

/** O cartão de um plugin, encontrado pelo nome que mostra. */
function cardOf(entry: CatalogEntry): HTMLElement {
  const card = screen
    .getAllByRole('listitem')
    .find((item) => within(item).queryByText(entry.name) !== null);

  if (!card) throw new Error(`Não há cartão para "${entry.name}".`);
  return card;
}

beforeEach(async () => {
  localStorage.clear();
  useNotificationStore.setState({ notifications: [] });
  await usePluginStore.getState().hydrate();
});

describe('loja de plugins', () => {
  it('diz de frente que nada é executado', () => {
    render(<PluginManagerWindow />);
    expect(screen.getByText(/nenhum plugin é descarregado nem executado/i)).toBeInTheDocument();
  });

  it('lista o catálogo todo na vista da loja', () => {
    render(<PluginManagerWindow />);
    for (const entry of PLUGIN_CATALOG) {
      expect(screen.getByText(entry.name)).toBeInTheDocument();
    }
  });

  it('mostra as permissões antes de haver botão para instalar', () => {
    render(<PluginManagerWindow />);

    const withShell = PLUGIN_CATALOG.find((entry) => entry.permissions.shell);
    expect(withShell).toBeDefined();
    expect(within(cardOf(withShell!)).getByText('Executar comandos')).toBeInTheDocument();
  });

  it('instalar guarda a escolha e notifica', async () => {
    const user = userEvent.setup();
    const entry = firstInstallable();
    render(<PluginManagerWindow />);

    await user.click(within(cardOf(entry)).getByRole('button', { name: /instalar/i }));

    expect(usePluginStore.getState().installed[entry.id]).toBeDefined();
    expect(
      useNotificationStore.getState().notifications.some((item) => item.category === 'plugins'),
    ).toBe(true);
  });

  it('depois de instalar, o botão passa a remover', async () => {
    const user = userEvent.setup();
    const entry = firstInstallable();
    render(<PluginManagerWindow />);

    await user.click(within(cardOf(entry)).getByRole('button', { name: /instalar/i }));

    expect(within(cardOf(entry)).getByRole('button', { name: /remover/i })).toBeInTheDocument();
    expect(within(cardOf(entry)).queryByRole('button', { name: /^instalar$/i })).toBeNull();
  });

  it('desativar mantém instalado', async () => {
    const user = userEvent.setup();
    const entry = firstInstallable();
    render(<PluginManagerWindow />);

    await user.click(within(cardOf(entry)).getByRole('button', { name: /instalar/i }));
    await user.click(within(cardOf(entry)).getByRole('button', { name: /desativar/i }));

    expect(usePluginStore.getState().installed[entry.id]?.isEnabled).toBe(false);
    expect(within(cardOf(entry)).getByText(/instalado, mas desativado/i)).toBeInTheDocument();
  });

  it('um plugin do sistema não oferece remoção', () => {
    render(<PluginManagerWindow />);

    const builtIn = PLUGIN_CATALOG.find((entry) => entry.isBuiltIn);
    expect(builtIn).toBeDefined();

    const card = within(cardOf(builtIn!));
    expect(card.queryByRole('button', { name: /remover/i })).toBeNull();
    expect(card.getByText(/faz parte do sistema/i)).toBeInTheDocument();
  });

  it('o que a plataforma não suporta fica indisponível, e diz porquê', () => {
    const capabilities = getPlatformAdapter().capabilities;
    const blocked = PLUGIN_CATALOG.find(
      (entry) => missingCapabilities(entry, capabilities).length > 0,
    );
    // O jsdom corre no WebAdapter, que tem capacidades a menos — se este teste
    // deixar de encontrar um bloqueado, é sinal de que o catálogo mudou.
    expect(blocked).toBeDefined();

    render(<PluginManagerWindow />);

    const card = within(cardOf(blocked!));
    expect(card.getByText(/indisponível neste dispositivo/i)).toBeInTheDocument();
    expect(card.getByRole('button', { name: /instalar/i })).toBeDisabled();
  });

  it('a vista de instalados começa só com os do sistema', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('tab', { name: /instalados/i }));

    const builtInCount = PLUGIN_CATALOG.filter((entry) => entry.isBuiltIn).length;
    expect(screen.getAllByRole('listitem')).toHaveLength(builtInCount);
  });

  it('a pesquisa ignora acentos', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.type(screen.getByRole('searchbox'), 'automacoes');

    expect(screen.getByText('Motor de automações')).toBeInTheDocument();
    expect(screen.queryByText('Spotify')).toBeNull();
  });

  it('filtrar por categoria mostra só essa categoria', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.click(screen.getByRole('button', { name: 'Desenvolvimento' }));

    const expected = PLUGIN_CATALOG.filter((entry) => entry.category === 'desenvolvimento').length;
    expect(screen.getAllByRole('listitem')).toHaveLength(expected);
  });

  it('sem resultados, explica-se em vez de mostrar uma lista vazia', async () => {
    const user = userEvent.setup();
    render(<PluginManagerWindow />);

    await user.type(screen.getByRole('searchbox'), 'zzzzzz');

    expect(screen.getByText(/nenhum plugin corresponde/i)).toBeInTheDocument();
  });
});
