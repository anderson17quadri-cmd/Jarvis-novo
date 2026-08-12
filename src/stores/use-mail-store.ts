import { create } from 'zustand';

import { mailService } from '@/services/mail/mail-service';
import type { MailboxSnapshot } from '@/types/mail';

interface MailState {
  /** Último snapshot da caixa de correio. `null` até à primeira leitura. */
  readonly snapshot: MailboxSnapshot | null;
  /** `true` até chegar a primeira leitura. */
  readonly isLoading: boolean;
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
}

export const useMailStore = create<MailState>((set, get) => ({
  snapshot: mailService.current,
  isLoading: mailService.current === null,
  providerName: mailService.providerName,

  refresh: async () => {
    const snapshot = await mailService.refresh();
    if (snapshot) set({ snapshot, isLoading: false });
  },

  hydrate: () => {
    if (get().snapshot === null && mailService.current !== null) {
      set({ snapshot: mailService.current, isLoading: false });
    }

    return mailService.subscribe((snapshot) => {
      set({ snapshot, isLoading: false });
    });
  },

  markRead: async (messageId, isRead = true) => {
    await mailService.markRead(messageId, isRead);
    const snapshot = mailService.current;
    if (snapshot) set({ snapshot });
  },

  toggleStar: async (messageId) => {
    await mailService.toggleStar(messageId);
    const snapshot = mailService.current;
    if (snapshot) set({ snapshot });
  },
}));
