import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import PrivacyWindow from '@/apps/privacy/PrivacyWindow';
import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';
import { usePluginStore } from '@/stores/use-plugin-store';
import { CAPABILITY_PRIVACY } from '@/types/privacy';

/** Um plugin instalável que peça permissões. */
const WITH_PERMISSIONS = PLUGIN_CATALOG.find(
  (entry) => !entry.isBuiltIn && Object.values(entry.permissions).some(Boolean),
);

beforeEach(async () => {
  localStorage.clear();
  logService.clear();
  await usePluginStore.getState().hydrate();
});

describe('permissões', () => {
  it('lista só os plugins instalados', async () => {
    render(<PrivacyWindow />);

    const builtIn = PLUGIN_CATALOG.filter((entry) => entry.isBuiltIn);
    for (const plugin of builtIn) {
      expect(await screen.findByText(plugin.name)).toBeInTheDocument();
    }
    expect(screen.queryByText('Terminal integrado')).toBeNull();
  });

  it('diz de frente que recusar já impede a sério os plugins com execução real', () => {
    render(<PrivacyWindow />);
    expect(
      screen.getByText(/recusar aqui só guarda a decisão para quando a execução existir/i),
    ).toBeInTheDocument();
  });

  it('recusar uma permissão guarda a decisão e regista-a', async () => {
    expect(WITH_PERMISSIONS).toBeDefined();
    usePluginStore.getState().install(WITH_PERMISSIONS!.id);

    const user = userEvent.setup();
    render(<PrivacyWindow />);

    const card = screen.getByRole('region', { name: WITH_PERMISSIONS!.name });
    const [toggle] = within(card).getAllByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle!);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => {
      expect(
        logService.list.some(
          (entry) => entry.source === 'auditoria' && entry.message.includes('recusado'),
        ),
      ).toBe(true);
    });
  });

  it('a recusa sobrevive a recarregar', async () => {
    usePluginStore.getState().install(WITH_PERMISSIONS!.id);
    usePluginStore.getState().setPermission(WITH_PERMISSIONS!.id, 'network', false);
    await usePluginStore.getState().persist();

    usePluginStore.setState({ deniedPermissions: {} });
    await usePluginStore.getState().hydrate();

    expect(usePluginStore.getState().deniedPermissions[WITH_PERMISSIONS!.id]).toContain('network');
  });

  it('o formato antigo — só a lista — continua a ser lido', async () => {
    // Quem já tinha plugins instalados não os pode perder ao atualizar.
    localStorage.setItem(
      'jarvis.plugins',
      JSON.stringify([{ id: 'spotify', installedAt: 1, isEnabled: true }]),
    );
    await usePluginStore.getState().hydrate();

    expect(usePluginStore.getState().installed['spotify']).toBeDefined();
    expect(usePluginStore.getState().deniedPermissions).toEqual({});
  });
});

describe('auditoria', () => {
  it('mostra o que o sistema fez', async () => {
    logService.audit('Abrir a janela emails por voz', 'executado');

    const user = userEvent.setup();
    render(<PrivacyWindow />);
    await user.click(screen.getByRole('tab', { name: /Auditoria/ }));

    expect(screen.getByText(/Abrir a janela emails por voz/)).toBeInTheDocument();
  });

  it('sem nada, explica-se em vez de ficar em branco', async () => {
    const user = userEvent.setup();
    render(<PrivacyWindow />);
    await user.click(screen.getByRole('tab', { name: /Auditoria/ }));

    expect(screen.getByText(/Nada a registar/i)).toBeInTheDocument();
  });
});

describe('acesso', () => {
  it('explica o que cada capacidade significa, e não só se está ligada', async () => {
    const user = userEvent.setup();
    render(<PrivacyWindow />);
    await user.click(screen.getByRole('tab', { name: 'Acesso' }));

    for (const item of CAPABILITY_PRIVACY) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it('o texto muda conforme a plataforma permite ou não', async () => {
    const capabilities = getPlatformAdapter().capabilities;
    const item = CAPABILITY_PRIVACY.find((entry) => !capabilities[entry.capability]);
    expect(item, 'o WebAdapter tem de recusar alguma coisa').toBeDefined();

    const user = userEvent.setup();
    render(<PrivacyWindow />);
    await user.click(screen.getByRole('tab', { name: 'Acesso' }));

    expect(screen.getByText(item!.whenDenied)).toBeInTheDocument();
  });
});
