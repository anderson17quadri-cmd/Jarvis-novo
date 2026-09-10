import { create } from 'zustand';

import { createId } from '@/lib/id';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  DEFAULT_TOAST_DURATION_MS,
  NOTIFICATION_HISTORY_LIMIT,
  type JarvisNotification,
  type NotificationAction,
  type NotificationCategory,
  type NotificationKind,
  type PersistedNotification,
} from '@/types/notification';

/** Quantos toasts podem estar em ecrã ao mesmo tempo. */
const MAX_VISIBLE_TOASTS = 4;

export interface PushOptions {
  readonly kind?: NotificationKind;
  readonly category?: NotificationCategory;
  readonly durationMs?: number | null;
  readonly actions?: readonly NotificationAction[];
}

interface NotificationState {
  /** Histórico completo, do mais recente para o mais antigo. */
  notifications: readonly JarvisNotification[];
  isPanelOpen: boolean;

  push: (title: string, description: string, options?: PushOptions) => string;
  /** Tira o toast do ecrã. A notificação continua no painel. */
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;

  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isPanelOpen: false,

  push: (title, description, options = {}) => {
    const notification: JarvisNotification = {
      id: createId('notif'),
      title,
      description,
      kind: options.kind ?? 'info',
      category: options.category ?? 'sistema',
      createdAt: Date.now(),
      durationMs: options.durationMs === undefined ? DEFAULT_TOAST_DURATION_MS : options.durationMs,
      isRead: false,
      isDismissed: false,
      actions: options.actions ?? [],
    };

    set((state) => ({
      // Mais recente primeiro, e o histórico não cresce sem limite.
      notifications: [notification, ...state.notifications].slice(0, NOTIFICATION_HISTORY_LIMIT),
    }));

    void get().persist();
    return notification.id;
  },

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, isDismissed: true } : item,
      ),
    })),

  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
    }));
    void get().persist();
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, isRead: true })),
    }));
    void get().persist();
  },

  remove: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
    void get().persist();
  },

  clearAll: () => {
    set({ notifications: [] });
    void get().persist();
  },

  setPanelOpen: (open) => {
    set({ isPanelOpen: open });
    // Abrir o painel é ver as notificações: deixam de contar como por ler.
    if (open) get().markAllRead();
  },

  togglePanel: () => get().setPanelOpen(!get().isPanelOpen),

  persist: async () => {
    const history: PersistedNotification[] = get().notifications.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      kind: item.kind,
      category: item.category,
      createdAt: item.createdAt,
      isRead: item.isRead,
    }));

    await storageService.set(STORAGE_KEYS.notifications, history);
  },

  hydrate: async () => {
    const saved = await storageService.get<PersistedNotification[]>(
      STORAGE_KEYS.notifications,
      [],
    );

    set({
      notifications: saved.map((item) => ({
        ...item,
        // As que vêm do histórico não voltam a aparecer como toast, e as ações
        // são funções: não sobrevivem à serialização.
        durationMs: null,
        isDismissed: true,
        actions: [],
      })),
    });
  },
}));

/** Toasts em ecrã: os que ainda não foram dispensados, os mais recentes. */
export function selectVisibleToasts(state: NotificationState): readonly JarvisNotification[] {
  return state.notifications.filter((item) => !item.isDismissed).slice(0, MAX_VISIBLE_TOASTS);
}

export function selectUnreadCount(state: NotificationState): number {
  return state.notifications.filter((item) => !item.isRead).length;
}

/**
 * Agrupa por categoria, mantendo a ordem cronológica dentro de cada grupo.
 *
 * Um `Map` e não um objeto: a ordem de inserção é garantida, e é ela que faz o
 * painel mostrar primeiro a categoria com a notificação mais recente.
 */
export function groupByCategory(
  notifications: readonly JarvisNotification[],
): ReadonlyMap<NotificationCategory, readonly JarvisNotification[]> {
  const groups = new Map<NotificationCategory, JarvisNotification[]>();

  for (const notification of notifications) {
    const existing = groups.get(notification.category);
    if (existing) existing.push(notification);
    else groups.set(notification.category, [notification]);
  }

  return groups;
}
