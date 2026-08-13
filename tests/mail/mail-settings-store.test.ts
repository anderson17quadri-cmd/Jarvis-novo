import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A regra do projeto: a palavra-passe do correio nunca fica em texto simples
 * no storage normal — vai para o cofre do sistema. Estes testes trocam o
 * adapter por um com `secretVault: true` e dois mapas (storage e cofre) para
 * verificar que a divisão acontece mesmo: o storage guarda servidor/porta/
 * utilizador, o cofre guarda a palavra-passe.
 */
const vault = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  secrets: new Map<string, string>(),
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    capabilities: { secretVault: true },
    storageSet: vi.fn(async (key: string, value: unknown) => {
      vault.storage.set(key, value);
    }),
    storageGet: vi.fn(async (key: string, fallback: unknown) =>
      vault.storage.has(key) ? vault.storage.get(key) : fallback,
    ),
    storageRemove: vi.fn(async (key: string) => {
      vault.storage.delete(key);
    }),
    secretSet: vi.fn(async (key: string, value: string) => {
      vault.secrets.set(key, value);
      return true;
    }),
    secretGet: vi.fn(async (key: string) => vault.secrets.get(key) ?? null),
    secretDelete: vi.fn(async (key: string) => {
      vault.secrets.delete(key);
      return true;
    }),
  }),
}));

import { useMailSettingsStore } from '@/stores/use-mail-settings-store';
import { DEFAULT_MAIL_SETTINGS } from '@/types/mail-settings';

beforeEach(() => {
  vault.storage.clear();
  vault.secrets.clear();
  useMailSettingsStore.setState({ settings: DEFAULT_MAIL_SETTINGS });
});

describe('a palavra-passe fica no cofre, nunca no storage', () => {
  it('guardar divide os dados: configuração no storage, segredo no cofre', async () => {
    useMailSettingsStore.setState({
      settings: {
        ...DEFAULT_MAIL_SETTINGS,
        imapServer: 'imap.gmail.com',
        smtpServer: 'smtp.gmail.com',
        username: 'voce@exemplo.com',
        password: 'segredo',
      },
    });

    await useMailSettingsStore.getState().persist();

    const stored = vault.storage.get('mail-settings') as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(stored.imapServer).toBe('imap.gmail.com');
    expect(stored.username).toBe('voce@exemplo.com');
    // O segredo não está no storage normal.
    expect(Object.prototype.hasOwnProperty.call(stored, 'password')).toBe(false);

    expect(vault.secrets.get('mail-password')).toBe('segredo');
  });

  it('hidratar volta a juntar o segredo do cofre à configuração do storage', async () => {
    vault.storage.set('mail-settings', {
      imapServer: 'imap.gmail.com',
      imapPort: 993,
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      username: 'voce@exemplo.com',
    });
    vault.secrets.set('mail-password', 'segredo');

    await useMailSettingsStore.getState().hydrate();

    expect(useMailSettingsStore.getState().settings.imapServer).toBe('imap.gmail.com');
    expect(useMailSettingsStore.getState().settings.username).toBe('voce@exemplo.com');
    expect(useMailSettingsStore.getState().settings.password).toBe('segredo');
  });

  it('sem palavra-passe, apaga-a do cofre', async () => {
    vault.secrets.set('mail-password', 'segredo');
    useMailSettingsStore.setState({
      settings: { ...DEFAULT_MAIL_SETTINGS, imapServer: 'imap.gmail.com' },
    });

    await useMailSettingsStore.getState().persist();

    expect(vault.secrets.has('mail-password')).toBe(false);
  });

  it('hidratar sem cofre e sem storage arranca nos valores de origem', async () => {
    await useMailSettingsStore.getState().hydrate();

    expect(useMailSettingsStore.getState().settings.imapPort).toBe(993);
    expect(useMailSettingsStore.getState().settings.password).toBe('');
  });
});
