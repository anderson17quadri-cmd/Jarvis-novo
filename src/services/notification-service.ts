import { getPlatformAdapter, type PlatformAdapter } from '@/platform';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import type { NotificationKind } from '@/types/notification';

/**
 * Notificações.
 *
 * Mostra sempre o toast interno — é o que dá continuidade visual ao sistema — e
 * tenta em paralelo a notificação nativa. Se a nativa não existir na plataforma,
 * o utilizador não perde nada nem vê um erro.
 */
export class NotificationService {
  constructor(private readonly adapter: PlatformAdapter = getPlatformAdapter()) {}

  notify(title: string, description: string, kind: NotificationKind = 'info'): string {
    const id = useNotificationStore.getState().push(title, description, kind);

    // A nativa é um extra: falhar não altera o que o utilizador vê.
    void this.adapter.sendNativeNotification(title, description);

    return id;
  }

  info(title: string, description: string): string {
    return this.notify(title, description, 'info');
  }

  /**
   * Sucesso. Além do toast, o núcleo celebra (Parte 8 §Sucesso).
   *
   * Só quando está em repouso: uma tarefa que termina a meio de uma resposta
   * não deve interromper a fala nem o estado de análise.
   */
  success(title: string, description: string): string {
    if (useAssistantStore.getState().mode === 'idle') {
      useAssistantStore.getState().celebrate();
    }
    return this.notify(title, description, 'ok');
  }

  warn(title: string, description: string): string {
    return this.notify(title, description, 'warn');
  }

  error(title: string, description: string): string {
    return this.notify(title, description, 'err');
  }

  dismiss(id: string): void {
    useNotificationStore.getState().dismiss(id);
  }
}

export const notificationService = new NotificationService();
