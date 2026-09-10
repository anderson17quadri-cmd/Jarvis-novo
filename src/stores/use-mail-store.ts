import { create } from 'zustand';

import { mailService } from '@/services/mail/mail-service';
import { notificationService } from '@/services/notification-service';
import type { MailboxSnapshot, OutgoingMessage } from '@/types/mail';

interface MailState {
  /** Último snapshot da caixa de correio. `null` até à primeira leitura. */
  readonly snapshot: MailboxSnapshot | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
  /** A última leitura falhou — `null` quando correu bem. */
  readonly error: string | null;
  /** Nome do provedor ativo, para o rodapé da janela. */
  readonly providerName: string;
  /** Força uma leitura avulsa. */
  readonly refresh: () => Promise<void>;
  /**
   * Liga a store ao serviço. Devolve a função de cancelamento — chamá-la
   * desliga a subscrição e pára a sondagem se não houver mais ninguém à
   * escuta.
   */
  readonly hydrate: () => () => void;

  // Ações que delegam no serviço — o componente lê da store e escreve pela
  // store, sem importar o serviço diretamente.
  readonly markRead: (messageId: string, isRead?: boolean) => Promise<void>;
  readonly toggleStar: (messageId: string) => Promise<void>;
  readonly send: (message: OutgoingMessage) => Promise<void>;
}

export const useMailStore = create<MailState>((set, get) => ({
  snapshot: mailService.current,
  isLoading: mailService.current === null,
  error: null,
  providerName: mailService.providerName,

  refresh: async () => {
    const snapshot = await mailService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    if (get().snapshot === null && mailService.current !== null) {
      set({ snapshot: mailService.current, isLoading: false });
    }

    const unsubData = mailService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
    const unsubError = mailService.subscribeError((error) => {
      set(error !== null ? { error, isLoading: false } : { error });
    });

    return () => {
      unsubData();
      unsubError();
    };
  },

  markRead: async (messageId, isRead = true) => {
    try {
      await mailService.markRead(messageId, isRead);
      const snapshot = mailService.current;
      if (snapshot) set({ snapshot });
    } catch {
      notificationService.error('Não consegui marcar a mensagem', 'Tenta outra vez daqui a pouco.');
    }
  },

  toggleStar: async (messageId) => {
    try {
      await mailService.toggleStar(messageId);
      const snapshot = mailService.current;
      if (snapshot) set({ snapshot });
    } catch {
      notificationService.error('Não consegui marcar a mensagem', 'Tenta outra vez daqui a pouco.');
    }
  },

  send: async (message) => {
    await mailService.send(message);
  },
}));
