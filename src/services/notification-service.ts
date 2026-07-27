import { getPlatformAdapter, type PlatformAdapter } from '@/platform';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore, type PushOptions } from '@/stores/use-notification-store';
import type { NotificationCategory } from '@/types/notification';

/** Opções sem a severidade — cada atalho já a fixa. */
type ShortcutOptions = Omit<PushOptions, 'kind'>;

/**
 * Notificações.
 *
 * Mostra sempre o toast interno — é o que dá continuidade visual ao sistema — e
 * tenta em paralelo a notificação nativa. Se a nativa não existir na
 * plataforma, o utilizador não perde nada nem vê um erro.
 */
export class NotificationService {
  constructor(private readonly adapter: PlatformAdapter = getPlatformAdapter()) {}

  notify(title: string, description: string, options: PushOptions = {}): string {
    const id = useNotificationStore.getState().push(title, description, options);

    // A nativa é um extra: falhar não altera o que o utilizador vê.
    void this.adapter.sendNativeNotification(title, description);

    return id;
  }

  info(title: string, description: string, options: ShortcutOptions = {}): string {
    return this.notify(title, description, { ...options, kind: 'info' });
  }

  /**
   * Sucesso. Além do toast, o núcleo celebra (Parte 8 §Sucesso).
   *
   * Só quando está em repouso: uma tarefa que termina a meio de uma resposta
   * não deve interromper a fala nem o estado de análise.
   */
  success(title: string, description: string, options: ShortcutOptions = {}): string {
    if (useAssistantStore.getState().mode === 'idle') {
      useAssistantStore.getState().celebrate();
    }
    return this.notify(title, description, { ...options, kind: 'ok' });
  }

  warn(title: string, description: string, options: ShortcutOptions = {}): string {
    return this.notify(title, description, { ...options, kind: 'warn' });
  }

  error(title: string, description: string, options: ShortcutOptions = {}): string {
    return this.notify(title, description, { ...options, kind: 'err' });
  }

  /** Atalho para notificações de uma categoria concreta. */
  fromCategory(category: NotificationCategory) {
    return {
      info: (title: string, description: string) => this.info(title, description, { category }),
      success: (title: string, description: string) =>
        this.success(title, description, { category }),
      warn: (title: string, description: string) => this.warn(title, description, { category }),
      error: (title: string, description: string) => this.error(title, description, { category }),
    };
  }

  dismiss(id: string): void {
    useNotificationStore.getState().dismiss(id);
  }
}

export const notificationService = new NotificationService();
