import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  groupByCategory,
  selectUnreadCount,
  selectVisibleToasts,
  useNotificationStore,
} from '@/stores/use-notification-store';
import { NOTIFICATION_HISTORY_LIMIT, type PersistedNotification } from '@/types/notification';

describe('useNotificationStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useNotificationStore.setState({ notifications: [], isPanelOpen: false });
  });

  describe('criar', () => {
    it('guarda título, descrição, severidade e categoria', () => {
      useNotificationStore
        .getState()
        .push('Título', 'Descrição', { kind: 'warn', category: 'email' });

      const [notification] = useNotificationStore.getState().notifications;
      expect(notification?.title).toBe('Título');
      expect(notification?.description).toBe('Descrição');
      expect(notification?.kind).toBe('warn');
      expect(notification?.category).toBe('email');
    });

    it('assume "info" e "sistema" quando não são dados', () => {
      useNotificationStore.getState().push('A', 'B');
      const [notification] = useNotificationStore.getState().notifications;

      expect(notification?.kind).toBe('info');
      expect(notification?.category).toBe('sistema');
    });

    it('a mais recente fica em primeiro', () => {
      useNotificationStore.getState().push('Primeira', '');
      useNotificationStore.getState().push('Segunda', '');

      expect(useNotificationStore.getState().notifications[0]?.title).toBe('Segunda');
    });

    it('dá identificadores distintos', () => {
      const first = useNotificationStore.getState().push('A', '');
      const second = useNotificationStore.getState().push('B', '');
      expect(first).not.toBe(second);
    });

    it('o histórico não cresce sem limite', () => {
      for (let i = 0; i < NOTIFICATION_HISTORY_LIMIT + 30; i++) {
        useNotificationStore.getState().push(`Nota ${i}`, '');
      }

      expect(useNotificationStore.getState().notifications).toHaveLength(
        NOTIFICATION_HISTORY_LIMIT,
      );
    });
  });

  describe('toasts e histórico são coisas diferentes', () => {
    it('dispensar tira do ecrã mas mantém no histórico', () => {
      const id = useNotificationStore.getState().push('A', '');
      useNotificationStore.getState().dismiss(id);

      const state = useNotificationStore.getState();
      expect(selectVisibleToasts(state)).toHaveLength(0);
      expect(state.notifications).toHaveLength(1);
    });

    it('uma rajada não enche o ecrã, mas nada se perde do histórico', () => {
      for (let i = 0; i < 12; i++) useNotificationStore.getState().push(`Nota ${i}`, '');

      const state = useNotificationStore.getState();
      expect(selectVisibleToasts(state).length).toBeLessThanOrEqual(4);
      expect(state.notifications).toHaveLength(12);
    });

    it('remover apaga mesmo, ao contrário de dispensar', () => {
      const id = useNotificationStore.getState().push('A', '');
      useNotificationStore.getState().push('B', '');

      useNotificationStore.getState().remove(id);

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(useNotificationStore.getState().notifications[0]?.title).toBe('B');
    });

    it('remover um identificador inexistente não rebenta', () => {
      useNotificationStore.getState().push('A', '');
      expect(() => useNotificationStore.getState().remove('não-existe')).not.toThrow();
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  describe('por ler', () => {
    it('nascem por ler', () => {
      useNotificationStore.getState().push('A', '');
      expect(selectUnreadCount(useNotificationStore.getState())).toBe(1);
    });

    it('abrir o painel marca todas como lidas', () => {
      useNotificationStore.getState().push('A', '');
      useNotificationStore.getState().push('B', '');

      useNotificationStore.getState().setPanelOpen(true);

      expect(selectUnreadCount(useNotificationStore.getState())).toBe(0);
    });

    it('fechar o painel não volta a marcar como por ler', () => {
      useNotificationStore.getState().push('A', '');
      useNotificationStore.getState().setPanelOpen(true);
      useNotificationStore.getState().setPanelOpen(false);

      expect(selectUnreadCount(useNotificationStore.getState())).toBe(0);
    });
  });

  describe('agrupamento por categoria', () => {
    it('junta as da mesma categoria', () => {
      useNotificationStore.getState().push('A', '', { category: 'email' });
      useNotificationStore.getState().push('B', '', { category: 'email' });
      useNotificationStore.getState().push('C', '', { category: 'automacao' });

      const groups = groupByCategory(useNotificationStore.getState().notifications);

      expect(groups.get('email')).toHaveLength(2);
      expect(groups.get('automacao')).toHaveLength(1);
    });

    it('a ordem dos grupos segue a notificação mais recente', () => {
      useNotificationStore.getState().push('Antiga', '', { category: 'plugins' });
      useNotificationStore.getState().push('Recente', '', { category: 'calendario' });

      const categories = [...groupByCategory(useNotificationStore.getState().notifications).keys()];
      expect(categories[0]).toBe('calendario');
    });

    it('a ordem dentro do grupo mantém-se cronológica', () => {
      useNotificationStore.getState().push('Primeira', '', { category: 'email' });
      useNotificationStore.getState().push('Segunda', '', { category: 'email' });

      const emails = groupByCategory(useNotificationStore.getState().notifications).get('email');
      expect(emails?.[0]?.title).toBe('Segunda');
    });
  });

  describe('ações rápidas', () => {
    it('guarda as ações e executa-as', () => {
      const run = vi.fn();
      useNotificationStore.getState().push('A', '', {
        actions: [{ id: 'abrir', label: 'Abrir', run }],
      });

      const [notification] = useNotificationStore.getState().notifications;
      expect(notification?.actions).toHaveLength(1);

      notification?.actions[0]?.run();
      expect(run).toHaveBeenCalledOnce();
    });
  });

  describe('persistência', () => {
    it('guarda e repõe o histórico', async () => {
      useNotificationStore.getState().push('Sobrevivente', 'Descrição', { category: 'email' });
      await useNotificationStore.getState().persist();

      useNotificationStore.setState({ notifications: [] });
      await useNotificationStore.getState().hydrate();

      const [restored] = useNotificationStore.getState().notifications;
      expect(restored?.title).toBe('Sobrevivente');
      expect(restored?.category).toBe('email');
    });

    it('o que vem do histórico não reaparece como toast', async () => {
      const saved: PersistedNotification[] = [
        {
          id: 'antiga',
          title: 'De ontem',
          description: '',
          kind: 'info',
          category: 'sistema',
          createdAt: Date.now() - 86_400_000,
          isRead: true,
        },
      ];
      await storageService.set(STORAGE_KEYS.notifications, saved);

      await useNotificationStore.getState().hydrate();

      // Senão, reabrir a aplicação despejava o histórico todo no ecrã.
      expect(selectVisibleToasts(useNotificationStore.getState())).toHaveLength(0);
    });

    it('limpar apaga o histórico e a persistência', async () => {
      useNotificationStore.getState().push('A', '');
      useNotificationStore.getState().clearAll();

      await useNotificationStore.getState().hydrate();
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });
});
