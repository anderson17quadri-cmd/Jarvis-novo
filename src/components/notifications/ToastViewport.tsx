import { useEffect } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { useIsCompact } from '@/hooks/use-media-query';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { selectVisibleToasts, useNotificationStore } from '@/stores/use-notification-store';
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
 * Passageiros por natureza: ao desaparecerem ficam no painel de notificações,
 * não se perdem. `aria-live="polite"` anuncia-os sem interromper o que o leitor
 * de ecrã estiver a ler.
 */
/**
 * Quantos cabem sem tapar o ecrã.
 *
 * Num telemóvel de 830px, quatro avisos empilhados ocupavam mais de metade da
 * altura e escondiam o que estava por baixo. Os que não cabem não se perdem —
 * ficam no painel de notificações, como todos os outros.
 */
const COMPACT_LIMIT = 2;

export function ToastViewport(): React.JSX.Element {
  const all = useNotificationStore(useShallow(selectVisibleToasts));
  const isCompact = useIsCompact();
  const toasts = isCompact ? all.slice(0, COMPACT_LIMIT) : all;

  return (
    <div
      aria-live="polite"
      aria-label="Notificações recentes"
      className={cn(
        'fixed bottom-24 right-5 z-toast flex w-[min(340px,calc(100vw-40px))] flex-col gap-2.5',
        'compact:inset-x-3 compact:bottom-20 compact:w-auto',
      )}
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {toasts.map((notification) => (
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
        // Mais apertado no telemóvel: dois avisos com o espaçamento do desktop
        // ocupavam mais de metade do ecrã.
        'compact:gap-2.5 compact:p-3',
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
        {/* Cortada a duas linhas no compacto — a descrição inteira fica no
            painel de notificações, que é onde se vai lê-la com calma. */}
        <div className="text-cap leading-[1.5] text-t3 compact:line-clamp-2">
          {notification.description}
        </div>

        {notification.actions.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {notification.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  action.run();
                  dismiss(notification.id);
                }}
                className="rounded-md border border-line px-2 py-1 text-[10.5px] text-t2 transition-colors hover:border-accent/35 hover:text-accent"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* A hora não entra no telemóvel: um aviso que acabou de aparecer não
            precisa de dizer que horas são. Fica no painel. */}
        <div className="mt-1.5 text-[10px] tracking-[0.06em] text-t3 compact:hidden">
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
