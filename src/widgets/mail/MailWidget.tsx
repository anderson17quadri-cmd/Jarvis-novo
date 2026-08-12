import { useEffect } from 'react';
import { Paperclip, Star } from 'lucide-react';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useIsVisible } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { mailService } from '@/services/mail/mail-service';
import { useMailStore } from '@/stores/use-mail-store';
import { MAIL_PRIORITY_LABELS } from '@/types/mail';

/**
 * Email (Parte 6.2 §Widgets previstos).
 *
 * Caixa de entrada, por ler, favoritos e indicador de anexos. Ler uma mensagem
 * marca-a como lida no provedor — que hoje é simulado, mas amanhã sincroniza
 * com o servidor sem o widget mudar.
 */
export default function MailWidget(): React.JSX.Element {
  const snapshot = useMailStore((s) => s.snapshot);
  const isLoadingStore = useMailStore((s) => s.isLoading);
  const markRead = useMailStore((s) => s.markRead);
  const isVisible = useIsVisible();

  useEffect(() => {
    const unsub = useMailStore.getState().hydrate();
    return unsub;
  }, []);

  useEffect(() => {
    mailService.setPaused(!isVisible);
  }, [isVisible]);

  const data = snapshot;

  if (isLoadingStore || !data) return <WidgetSkeleton />;
  if (data.messages.length === 0) {
    return <WidgetEmpty message="A caixa de entrada está vazia." />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-shrink-0 items-baseline gap-2">
        <span className="mono text-[22px] font-light leading-none compact:text-[18px]">{data.unreadCount}</span>
        <span className="text-[11px] text-t2">por ler</span>
        {data.actionCount > 0 && (
          <span className="ml-auto rounded-full bg-warn/[.12] px-2 py-0.5 text-[10px] text-warn">
            {data.actionCount} pedem ação
          </span>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {data.messages.map((message) => (
          <li key={message.id}>
            <button
              type="button"
              onClick={() => void markRead(message.id, !message.isRead)}
              aria-label={`${message.isRead ? 'Marcar como não lida' : 'Marcar como lida'}: ${message.subject}`}
              className={cn(
                'flex w-full items-start gap-2 rounded-lg border border-transparent p-2 text-left',
                'transition-colors hover:border-line hover:bg-tint/[.03]',
                message.isRead && 'opacity-55',
              )}
            >
              {/* Ponto de estado: amarelo pede ação, ciano é informativo. */}
              <span
                className={cn(
                  'mt-1.5 h-[6px] w-[6px] flex-shrink-0 rounded-full',
                  message.priority === 'acao' ? 'bg-warn' : 'bg-accent',
                  message.isRead && 'opacity-40',
                )}
                aria-hidden="true"
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'truncate text-[11.5px]',
                      message.isRead ? 'font-normal text-t2' : 'font-semibold text-t1',
                    )}
                  >
                    {message.from}
                  </span>
                  {message.isStarred && (
                    <Star className="h-2.5 w-2.5 flex-shrink-0 fill-warn text-warn" aria-hidden="true" />
                  )}
                  {message.hasAttachments && (
                    <Paperclip className="h-2.5 w-2.5 flex-shrink-0 text-t3" aria-hidden="true" />
                  )}
                  <span className="mono ml-auto flex-shrink-0 text-[9.5px] text-t3">
                    {formatTime(new Date(message.receivedAt))}
                  </span>
                </span>

                <span className="mt-0.5 block truncate text-[11px] text-t2">
                  {message.subject}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-t3">
                  {message.preview}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-t3">
        {data.isSimulated ? 'Caixa simulada · ' : ''}
        {MAIL_PRIORITY_LABELS.acao} a amarelo
      </p>
    </div>
  );
}
