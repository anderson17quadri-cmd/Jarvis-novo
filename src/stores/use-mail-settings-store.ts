import { create } from 'zustand';

import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { DEFAULT_MAIL_SETTINGS, type MailSettings } from '@/types/mail-settings';

/**
 * Configuração do correio real (Peça 8, lote 2).
 *
 * **Só estado e persistência** — mesmo padrão da `useNewsSettingsStore`. A
 * conversão das preferências no provedor em vigor está no hook
 * `useMailSettings`. Esta store guarda e hidrata, só.
 *
 * O correio precisa de vários dados de ligação, mas só **um** é segredo: a
 * palavra-passe/token. Servidor, porta e utilizador são configuração pública
 * (o utilizador é o próprio endereço). Por isso só a palavra-passe vai para o
 * cofre do sistema — nunca para o storage normal. Sem cofre (browser,
 * Android), mantém-se no storage, como sempre, com o aviso na interface.
 */
interface MailSettingsState {
  settings: MailSettings;

  setImapServer: (server: string) => void;
  setImapPort: (port: number) => void;
  setSmtpServer: (server: string) => void;
  setSmtpPort: (port: number) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  /** Esquece a palavra-passe — o resto da configuração fica. */
  forgetPassword: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** Devolve uma cópia das definições sem a palavra-passe. */
function semSegredos(settings: MailSettings): Omit<MailSettings, 'password'> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key !== 'password') {
      result[key] = value;
    }
  }
  return result as unknown as Omit<MailSettings, 'password'>;
}

export const useMailSettingsStore = create<MailSettingsState>((set, get) => ({
  settings: DEFAULT_MAIL_SETTINGS,

  setImapServer: (server) => {
    const settings = { ...get().settings, imapServer: server.trim() };
    set({ settings });
    void get().persist();
  },

  setImapPort: (port) => {
    const settings = {
      ...get().settings,
      imapPort: Number.isFinite(port) && port > 0 ? Math.trunc(port) : DEFAULT_MAIL_SETTINGS.imapPort,
    };
    set({ settings });
    void get().persist();
  },

  setSmtpServer: (server) => {
    const settings = { ...get().settings, smtpServer: server.trim() };
    set({ settings });
    void get().persist();
  },

  setSmtpPort: (port) => {
    const settings = {
      ...get().settings,
      smtpPort: Number.isFinite(port) && port > 0 ? Math.trunc(port) : DEFAULT_MAIL_SETTINGS.smtpPort,
    };
    set({ settings });
    void get().persist();
  },

  setUsername: (username) => {
    const settings = { ...get().settings, username: username.trim() };
    set({ settings });
    void get().persist();
  },

  setPassword: (password) => {
    const settings = { ...get().settings, password };
    set({ settings });

    logService.audit(
      password.trim().length > 0
        ? 'Guardar a palavra-passe do correio'
        : 'Apagar a palavra-passe do correio',
      'executado',
    );
    void get().persist();
  },

  forgetPassword: () => {
    const settings: MailSettings = { ...get().settings, password: '' };
    set({ settings });

    logService.audit('Apagar a palavra-passe do correio e voltar ao simulado', 'executado');
    void get().persist();
  },

  persist: async () => {
    const { settings } = get();
    const adapter = getPlatformAdapter();

    if (adapter.capabilities.secretVault) {
      // Cofre disponível: definições sem segredos → storage, palavra-passe → cofre.
      await storageService.set(STORAGE_KEYS.mailSettings, semSegredos(settings));

      if (settings.password) {
        await adapter.secretSet('mail-password', settings.password);
      } else {
        await adapter.secretDelete('mail-password');
      }
    } else {
      // Sem cofre: comportamento de sempre — tudo no storage.
      await storageService.set(STORAGE_KEYS.mailSettings, settings);
    }
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<MailSettings> | null>(
      STORAGE_KEYS.mailSettings,
      null,
    );

    const adapter = getPlatformAdapter();
    let password = '';

    if (adapter.capabilities.secretVault) {
      password = (await adapter.secretGet('mail-password')) ?? '';
    } else {
      password = typeof saved?.password === 'string' ? saved.password : '';
    }

    // A palavra-passe vem do cofre; o que veio do storage só contribui com o
    // resto (servidor, portas, utilizador).
    const cleanSaved: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(saved ?? {})) {
      if (chave !== 'password') {
        cleanSaved[chave] = valor;
      }
    }

    const settings: MailSettings = {
      ...DEFAULT_MAIL_SETTINGS,
      ...cleanSaved,
      password,
    };

    set({ settings });
  },
}));
