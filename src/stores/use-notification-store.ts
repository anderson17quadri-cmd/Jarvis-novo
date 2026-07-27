import { create } from 'zustand';

import { createId } from '@/lib/id';
import {
  DEFAULT_TOAST_DURATION_MS,
  type JarvisNotification,
  type NotificationKind,
} from '@/types/notification';

/** Quantos toasts podem estar em ecrã ao mesmo tempo. */
const MAX_VISIBLE = 4;

interface NotificationState {
  notifications: readonly JarvisNotification[];
  push: (
    title: string,
    description: string,
    kind?: NotificationKind,
    durationMs?: number | null,
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  push: (title, description, kind = 'info', durationMs = DEFAULT_TOAST_DURATION_MS) => {
    const notification: JarvisNotification = {
      id: createId('toast'),
      title,
      description,
      kind,
      createdAt: Date.now(),
      durationMs,
    };

    set((state) => ({
      // Uma rajada de notificações não pode encher o ecrã: fica só a cauda.
      notifications: [...state.notifications, notification].slice(-MAX_VISIBLE),
    }));

    return notification.id;
  },

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),

  clear: () => set({ notifications: [] }),
}));
