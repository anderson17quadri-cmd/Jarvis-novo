import { beforeEach, describe, expect, it } from 'vitest';

import { useNotificationStore } from '@/stores/use-notification-store';

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it('guarda título, descrição e severidade', () => {
    useNotificationStore.getState().push('Título', 'Descrição', 'warn');
    const [notification] = useNotificationStore.getState().notifications;

    expect(notification?.title).toBe('Título');
    expect(notification?.description).toBe('Descrição');
    expect(notification?.kind).toBe('warn');
  });

  it('assume "info" quando a severidade não é dada', () => {
    useNotificationStore.getState().push('A', 'B');
    expect(useNotificationStore.getState().notifications[0]?.kind).toBe('info');
  });

  it('uma rajada não enche o ecrã: fica só a cauda', () => {
    for (let i = 0; i < 12; i++) {
      useNotificationStore.getState().push(`Nota ${i}`, '');
    }

    const { notifications } = useNotificationStore.getState();
    expect(notifications.length).toBeLessThanOrEqual(4);
    // As que ficam são as mais recentes.
    expect(notifications.at(-1)?.title).toBe('Nota 11');
  });

  it('dá identificadores distintos', () => {
    const first = useNotificationStore.getState().push('A', '');
    const second = useNotificationStore.getState().push('B', '');
    expect(first).not.toBe(second);
  });

  it('fecha por identificador sem tocar nas outras', () => {
    const first = useNotificationStore.getState().push('A', '');
    useNotificationStore.getState().push('B', '');

    useNotificationStore.getState().dismiss(first);
    const { notifications } = useNotificationStore.getState();

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toBe('B');
  });

  it('fechar um identificador inexistente não rebenta', () => {
    useNotificationStore.getState().push('A', '');
    expect(() => useNotificationStore.getState().dismiss('não-existe')).not.toThrow();
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });
});
