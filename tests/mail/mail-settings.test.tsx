import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MailSettings } from '@/apps/personalization/MailSettings';
import { applyMailSettings } from '@/hooks/use-mail-settings';
import { MockMailProvider } from '@/services/mail/providers/mail-provider';
import { mailService } from '@/services/mail/mail-service';
import { useMailSettingsStore } from '@/stores/use-mail-settings-store';
import { DEFAULT_MAIL_SETTINGS } from '@/types/mail-settings';

beforeEach(() => {
  localStorage.clear();
  useMailSettingsStore.setState({ settings: DEFAULT_MAIL_SETTINGS });
  mailService.setProvider(new MockMailProvider());
});

afterEach(() => {
  mailService.setProvider(new MockMailProvider());
});

describe('escolha do provedor', () => {
  it('por omissão fica no simulado — nada sai sem ser pedido', () => {
    applyMailSettings(DEFAULT_MAIL_SETTINGS);

    expect(mailService.providerName).toBe('Simulado');
  });

  it('com servidor + utilizador + palavra-passe passa a IMAP', () => {
    applyMailSettings({
      ...DEFAULT_MAIL_SETTINGS,
      imapServer: 'imap.gmail.com',
      username: 'voce@exemplo.com',
      password: 'senha',
    });

    expect(mailService.providerName).toBe('IMAP');
  });

  it('sem palavra-passe mantém o simulado', () => {
    applyMailSettings({
      ...DEFAULT_MAIL_SETTINGS,
      imapServer: 'imap.gmail.com',
      username: 'voce@exemplo.com',
    });

    expect(mailService.providerName).toBe('Simulado');
  });
});

describe('a interface', () => {
  it('avisa o que sai do dispositivo e onde fica a palavra-passe', () => {
    render(<MailSettings />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/servidores IMAP e SMTP/i);
    expect(note).toHaveTextContent(/cofre do sistema/i);
  });

  it('guardar a palavra-passe mostra-a tapada, sem a revelar', async () => {
    const user = userEvent.setup();
    render(<MailSettings />);

    await user.type(screen.getByLabelText('Palavra-passe'), 'senha-de-teste');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('••••••••••')).toBeInTheDocument();
    expect(screen.queryByText('senha-de-teste')).toBeNull();
  });

  it('apagar a palavra-passe volta a mostrar o campo', async () => {
    const user = userEvent.setup();
    render(<MailSettings />);

    await user.type(screen.getByLabelText('Palavra-passe'), 'senha-de-teste');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(await screen.findByLabelText('Apagar a palavra-passe'));

    expect(useMailSettingsStore.getState().settings.password).toBe('');
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar e o provedor volta a ser ligado', async () => {
    useMailSettingsStore.getState().setImapServer('imap.gmail.com');
    useMailSettingsStore.getState().setUsername('voce@exemplo.com');
    useMailSettingsStore.getState().setPassword('senha-de-teste');
    await useMailSettingsStore.getState().persist();

    useMailSettingsStore.setState({ settings: DEFAULT_MAIL_SETTINGS });
    await useMailSettingsStore.getState().hydrate();
    applyMailSettings(useMailSettingsStore.getState().settings);

    expect(useMailSettingsStore.getState().settings.imapServer).toBe('imap.gmail.com');
    expect(useMailSettingsStore.getState().settings.password).toBe('senha-de-teste');
    expect(mailService.providerName).toBe('IMAP');
  });

  it('sem nada gravado, arranca no simulado', async () => {
    await useMailSettingsStore.getState().hydrate();
    applyMailSettings(useMailSettingsStore.getState().settings);

    expect(useMailSettingsStore.getState().settings.password).toBe('');
    expect(mailService.providerName).toBe('Simulado');
  });
});
