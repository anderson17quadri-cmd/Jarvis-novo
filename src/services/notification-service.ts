import { getPlatformAdapter, type PlatformAdapter } from '@/platform';
import { soundService, type SoundName } from './sound-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore, type PushOptions } from '@/stores/use-notification-store';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { allowsToast } from '@/types/system-state';
import type { NotificationCategory, NotificationKind } from '@/types/notification';

/** Que som corresponde a cada severidade. */
const SOUND_BY_KIND: Record<NotificationKind, SoundName> = {
  info: 'notify',
  ok: 'success',
  warn: 'notify',
  err: 'error',
};

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

    /*
     * Estados do sistema (Parte 9): em Foco e Economia só o que for grave
     * interrompe; em Apresentação, nada. A notificação entra na mesma no
     * histórico — o que se corta é a interrupção, não a informação. Dispensar
     * no mesmo tick evita qualquer piscar.
     */
    const state = useSystemStateStore.getState().definition;
    const mayInterrupt = allowsToast(state, options.kind ?? 'info');
    if (!mayInterrupt) useNotificationStore.getState().dismiss(id);

    // A nativa é um extra: falhar não altera o que o utilizador vê. Não se
    // envia — nem se toca — o que o estado do sistema acabou de mandar calar.
    if (mayInterrupt) {
      void this.adapter.sendNativeNotification(title, description);
      soundService.play(SOUND_BY_KIND[options.kind ?? 'info']);
    }

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
