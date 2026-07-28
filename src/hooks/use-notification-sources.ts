import { useEffect, useRef } from 'react';

import { eventBus } from '@/services/event-bus';
import { mailService } from '@/services/mail/mail-service';
import { notificationService } from '@/services/notification-service';
import { useWindowStore } from '@/stores/use-window-store';
import { getAppDefinition } from '@/apps/registry';

/**
 * Liga os serviços de dados ao sistema de notificações.
 *
 * Vive num hook e não dentro dos serviços de propósito: um serviço de email não
 * deve saber que existem notificações. Aqui é a camada que os junta, e é o
 * único sítio a mexer se as regras mudarem.
 */
export function useNotificationSources(isActive: boolean): void {
  /** Mensagens já anunciadas, para não repetir a cada sondagem. */
  const announcedRef = useRef(new Set<string>());
  const hasAnnouncedSummaryRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;

    return mailService.subscribe((snapshot) => {
      const pendingAction = snapshot.messages.filter(
        (message) => message.priority === 'acao' && !message.isRead,
      );

      // Resumo, uma vez por sessão: é o que o assistente anuncia no arranque.
      if (!hasAnnouncedSummaryRef.current && pendingAction.length > 0) {
        hasAnnouncedSummaryRef.current = true;
        for (const message of pendingAction) announcedRef.current.add(message.id);

        notificationService.warn(
          `${pendingAction.length} emails a pedir ação`,
          'Triagem concluída. Abra a caixa de entrada para responder.',
          {
            category: 'email',
            actions: [
              {
                id: 'abrir-email',
                label: 'Abrir Emails',
                run: () => {
                  const definition = getAppDefinition('emails');
                  useWindowStore
                    .getState()
                    .open('emails', definition.title, { x: 160, y: 120, width: 440, height: 360 });
                },
              },
            ],
          },
        );
        return;
      }

      // Depois do resumo, só o que for mesmo novo.
      for (const message of pendingAction) {
        if (announcedRef.current.has(message.id)) continue;
        announcedRef.current.add(message.id);

        eventBus.emit('email:novo', { from: message.from, subject: message.subject });
        notificationService.info(`Novo email de ${message.from}`, message.subject, {
          category: 'email',
        });
      }
    });
  }, [isActive]);
}
