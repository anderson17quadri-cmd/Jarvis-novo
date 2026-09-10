import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCheck, Info, Search, Trash2, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import {
  groupByCategory,
  selectUnreadCount,
  useNotificationStore,
} from '@/stores/use-notification-store';
import {
  NOTIFICATION_CATEGORY_LABELS,
  type JarvisNotification,
  type NotificationCategory,
  type NotificationKind,
} from '@/types/notification';
import { normalizeSearch as normalize } from '@/utils/text';

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  info: Info,
  ok: Check,
  warn: AlertTriangle,
  err: AlertTriangle,
};

const KIND_STYLE: Record<NotificationKind, string> = {
  info: 'bg-accent/[.12] text-accent',
  ok: 'bg-ok/[.12] text-ok',
  warn: 'bg-warn/[.12] text-warn',
  err: 'bg-danger/[.12] text-danger',
};

/**
 * Painel lateral de notificações (Parte 6.2 §Sistema de notificações).
 *
 * Agrupamento por categoria, pesquisa, ações rápidas e persistência. Distinto
 * dos toasts: estes são passageiros, o painel é o histórico.
 */
export function NotificationPanel(): React.JSX.Element | null {
  const isOpen = useNotificationStore((state) => state.isPanelOpen);
  const setPanelOpen = useNotificationStore((state) => state.setPanelOpen);
  const notifications = useNotificationStore(useShallow((state) => state.notifications));
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const unreadCount = useNotificationStore(selectUnreadCount);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NotificationCategory | 'todas'>('todas');
  const searchRef = useRef<HTMLInputElement>(null);

  // Escape fecha, e o foco entra na pesquisa ao abrir.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPanelOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => searchRef.current?.focus(), 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, setPanelOpen]);

  const filtered = useMemo(() => {
    const normalized = normalize(query);

    return notifications.filter((item) => {
      if (category !== 'todas' && item.category !== category) return false;
      if (normalized.length === 0) return true;
      return normalize(`${item.title} ${item.description}`).includes(normalized);
    });
  }, [category, notifications, query]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);
  const presentCategories = useMemo(
    () => [...new Set(notifications.map((item) => item.category))],
    [notifications],
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[149] bg-black/40 backdrop-blur-soft"
        onClick={() => setPanelOpen(false)}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notificações"
        className={cn(
          'fixed bottom-0 right-0 top-header z-[151] flex w-[min(380px,100vw)] flex-col',
          'border-l border-line-2 bg-glass-deep/[.94] shadow-2 backdrop-blur-glass',
          'motion-safe:animate-toast-in',
        )}
      >
        <header className="flex flex-shrink-0 items-center gap-2 border-b border-line px-s3 py-3">
          <h2 className="flex-1 text-[15px] font-semibold">Notificações</h2>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              aria-label="Marcar todas como lidas"
              title="Marcar todas como lidas"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-t3 transition-colors hover:bg-card-hover hover:text-accent"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Limpar histórico"
              title="Limpar histórico"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-t3 transition-colors hover:bg-danger/[.18] hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Fechar painel"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-t3 transition-colors hover:bg-card-hover hover:text-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-shrink-0 flex-col gap-2 border-b border-line px-s3 py-2.5">
          <div className="flex h-9 items-center gap-2 rounded-input border border-line bg-tint/[.03] px-3 focus-within:border-accent/40">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-t3" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar notificações"
              aria-label="Pesquisar notificações"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-t3"
            />
          </div>

          {presentCategories.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              <CategoryChip
                label="Todas"
                isActive={category === 'todas'}
                onClick={() => setCategory('todas')}
              />
              {presentCategories.map((item) => (
                <CategoryChip
                  key={item}
                  label={NOTIFICATION_CATEGORY_LABELS[item]}
                  isActive={category === item}
                  onClick={() => setCategory(item)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-s3 py-2">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-t3">
              {notifications.length === 0
                ? 'Sem notificações.'
                : 'Nenhuma notificação corresponde à pesquisa.'}
            </p>
          ) : (
            [...groups.entries()].map(([groupCategory, items]) => (
              <section key={groupCategory} className="mb-3">
                <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-t3">
                  {NOTIFICATION_CATEGORY_LABELS[groupCategory]}
                  <span className="ml-1.5 font-normal normal-case tracking-normal">
                    {items.length}
                  </span>
                </h3>

                <ul className="space-y-1">
                  {items.map((notification) => (
                    <PanelItem key={notification.id} notification={notification} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function PanelItem({
  notification,
}: {
  readonly notification: JarvisNotification;
}): React.JSX.Element {
  const remove = useNotificationStore((state) => state.remove);
  const Icon = KIND_ICON[notification.kind];

  return (
    <li
      className={cn(
        'group/notif flex gap-2.5 rounded-lg border border-transparent p-2.5',
        'transition-colors hover:border-line hover:bg-tint/[.03]',
        notification.isRead && 'opacity-65',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
          KIND_STYLE[notification.kind],
        )}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="flex-1 truncate text-[12.5px] font-medium">{notification.title}</span>
          <span className="mono flex-shrink-0 text-[9.5px] text-t3">
            {formatTime(new Date(notification.createdAt))}
          </span>
        </div>

        <p className="mt-0.5 text-[11px] leading-[1.45] text-t3">{notification.description}</p>

        {notification.actions.length > 0 && (
          <div className="mt-1.5 flex gap-1.5">
            {notification.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.run}
                className="rounded-md border border-line px-2 py-1 text-[10.5px] text-t2 transition-colors hover:border-accent/35 hover:text-accent"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => remove(notification.id)}
        aria-label={`Remover: ${notification.title}`}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center self-start rounded text-t3 opacity-0 transition-opacity hover:text-danger group-hover/notif:opacity-100 focus:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}

function CategoryChip({
  label,
  isActive,
  onClick,
}: {
  readonly label: string;
  readonly isActive: boolean;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-all duration-hover',
        isActive
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-line text-t3 hover:border-line-2 hover:text-t2',
      )}
    >
      {label}
    </button>
  );
}
