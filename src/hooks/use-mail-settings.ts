import { useEffect } from 'react';

import { mailService } from '@/services/mail/mail-service';
import { MockMailProvider } from '@/services/mail/providers/mail-provider';
import { ImapMailProvider } from '@/services/mail/providers/imap-mail-provider';
import { useMailSettingsStore } from '@/stores/use-mail-settings-store';
import type { MailSettings } from '@/types/mail-settings';

/**
 * Constrói e liga o provedor de correio descrito pelas preferências.
 *
 * A presença de servidor IMAP + utilizador + palavra-passe é a configuração:
 * sem elas, mantém-se o simulado — como na DeepSeek, cair no local é melhor do
 * que deixar o widget vazio à espera de uma configuração que falta.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store.
 */
export function applyMailSettings(settings: MailSettings): void {
  const configured =
    settings.imapServer.trim().length > 0 &&
    settings.username.trim().length > 0 &&
    settings.password.trim().length > 0;

  if (configured) {
    mailService.setProvider(new ImapMailProvider(settings));
    return;
  }

  mailService.setProvider(new MockMailProvider());
}

/**
 * Aplica as preferências de correio ao serviço sempre que mudam.
 *
 * Mesma forma do `useNewsSettings`: a store guarda e hidrata, este hook converte
 * as preferências no provedor em vigor. Monta-se uma vez, no arranque.
 */
export function useMailSettings(): void {
  const settings = useMailSettingsStore((state) => state.settings);

  useEffect(() => {
    applyMailSettings(settings);
  }, [settings]);
}
