import { useEffect } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { useNotificationStore } from '@/stores/use-notification-store';
import type { JarvisNotification, NotificationKind } from '@/types/notification';

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
 * Toasts, no canto inferior direito.
 *
 * `aria-live="polite"` anuncia-os sem interromper o que o leitor de ecrã estiver
 * a ler. Cada toast fecha-se sozinho ao fim do seu tempo, ou à mão.
 */
export function ToastViewport(): React.JSX.Element {
  const notifications = useNotificationStore((state) => state.notifications);

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      className={cn(
        'fixed bottom-24 right-5 z-toast flex w-[min(340px,calc(100vw-40px))] flex-col gap-2.5',
        'compact:inset-x-3 compact:bottom-20 compact:w-auto',
      )}
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function Toast({ notification }: { readonly notification: JarvisNotification }): React.JSX.Element {
  const dismiss = useNotificationStore((state) => state.dismiss);
  const Icon = KIND_ICON[notification.kind];

  useEffect(() => {
    if (notification.durationMs === null) return;
    const timer = setTimeout(() => dismiss(notification.id), notification.durationMs);
    return () => clearTimeout(timer);
  }, [dismiss, notification.durationMs, notification.id]);

  return (
    <div
      role="status"
      className={cn(
        'flex gap-3 rounded-input border border-line-2 bg-[rgb(16_25_34_/_0.94)] p-3.5',
        'shadow-1 backdrop-blur-panel motion-safe:animate-toast-in',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[11px]',
          KIND_STYLE[notification.kind],
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-[3px] text-[13.5px] font-semibold">{notification.title}</div>
        <div className="text-cap leading-[1.5] text-t3">{notification.description}</div>
        <div className="mt-1.5 text-[10px] tracking-[0.06em] text-t3">
          {formatTime(new Date(notification.createdAt))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => dismiss(notification.id)}
        aria-label={`Fechar notificação: ${notification.title}`}
        className="flex self-start p-0.5 text-t3 transition-colors hover:text-t1"
      >
        <X className="h-[13px] w-[13px]" />
      </button>
    </div>
  );
}
