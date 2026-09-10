import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Inbox,
  Paperclip,
  PenSquare,
  Send,
  Star,
  X,
  Archive as ArchiveIcon,
} from 'lucide-react';

import {
  attachmentsFromFileList,
  formatBytes,
  pickAttachmentsNative,
  type DraftAttachment,
} from '@/platform/attachments';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { useIsVisible } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { formatShortDate, formatTime } from '@/lib/format';
import { mailService } from '@/services/mail/mail-service';
import { useMailStore } from '@/stores/use-mail-store';
import { MAIL_PRIORITY_LABELS, type MailFolder, type MailMessage } from '@/types/mail';
import { normalizeSearch } from '@/utils/text';

/**
 * Emails.
 *
 * Lista e leitura em cima do `mailService` que já servia o widget — a janela
 * não conhece o provedor. Quando um provedor IMAP real entrar, é ele que muda;
 * isto fica igual.
 *
 * A leitura substitui a lista em vez de aparecer ao lado: a janela é
 * redimensionável e pode estar com 400px de largura, onde duas colunas seriam
 * duas colunas ilegíveis.
 */
export default function EmailsWindow(): React.JSX.Element {
  const snapshot = useMailStore((s) => s.snapshot);
  const isLoadingStore = useMailStore((s) => s.isLoading);
  const providerName = useMailStore((s) => s.providerName);
  const markRead = useMailStore((s) => s.markRead);
  const isVisible = useIsVisible();
  /** `true` até chegar uma leitura real — é isso que desliga o envio. */
  const isSimulated = snapshot?.isSimulated ?? true;

  useEffect(() => {
    const unsub = useMailStore.getState().hydrate();
    return unsub;
  }, []);

  useEffect(() => {
    mailService.setPaused(!isVisible);
  }, [isVisible]);

  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isComposing, setComposing] = useState(false);

  const messages = useMemo(() => {
    const all = snapshot?.messages ?? [];
    const normalized = normalizeSearch(query);

    return all
      .filter((message) => message.folder === folder)
      .filter((message) =>
        normalized.length === 0
          ? true
          : normalizeSearch(`${message.from} ${message.subject} ${message.preview}`).includes(
              normalized,
            ),
      )
      .sort((a, b) => b.receivedAt - a.receivedAt);
  }, [snapshot, folder, query]);

  const open = messages.find((message) => message.id === openId) ?? null;

  if (isLoadingStore) return <p className="text-desc text-t3">A ler a caixa de correio…</p>;

  if (isComposing) {
    return <Compose onClose={() => setComposing(false)} />;
  }

  if (open) {
    return <Reading message={open} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="flex h-full flex-col gap-s2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setComposing(true)}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border border-accent/50 bg-accent/[.1] px-2.5 py-2',
            'text-[12px] font-medium text-accent transition-all duration-hover ease-out',
            'hover:bg-accent/[.16] active:scale-[.98] compact:min-h-[44px]',
          )}
        >
          <PenSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Nova mensagem
        </button>

        <FolderTab
          isActive={folder === 'inbox'}
          onClick={() => setFolder('inbox')}
          icon={Inbox}
          label="Entrada"
          count={snapshot?.unreadCount ?? 0}
        />
        <FolderTab
          isActive={folder === 'sent'}
          onClick={() => setFolder('sent')}
          icon={Send}
          label="Enviados"
        />
        <FolderTab
          isActive={folder === 'archive'}
          onClick={() => setFolder('archive')}
          icon={ArchiveIcon}
          label="Arquivo"
        />

        <label className="ml-auto min-w-[120px] flex-1">
          <span className="sr-only">Pesquisar emails</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar…"
            className={cn(
              'w-full rounded-input border border-line bg-tint/[.03] px-2.5 py-2',
              'text-[12px] outline-none transition-colors duration-hover',
              'placeholder:text-t3 focus:border-accent/45',
            )}
          />
        </label>
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {messages.map((message) => (
          <li key={message.id}>
            <div
              className={cn(
                'flex items-start gap-2 rounded-input border border-transparent p-2',
                'transition-colors duration-hover hover:border-line hover:bg-tint/[.03]',
                message.isRead && 'opacity-60',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(message.id);
                  if (!message.isRead) void markRead(message.id);
                }}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <span
                  className={cn(
                    'mt-1.5 h-[6px] w-[6px] flex-shrink-0 rounded-full',
                    message.priority === 'acao' ? 'bg-warn' : 'bg-accent',
                    message.isRead && 'opacity-40',
                  )}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn('truncate text-[12.5px]', !message.isRead && 'font-semibold')}
                    >
                      {message.from}
                    </span>
                    <span className="mono flex-shrink-0 text-[10.5px] text-t3">
                      {formatTime(new Date(message.receivedAt))}
                    </span>
                  </span>

                  <span className="mt-0.5 block truncate text-[12px] text-t2">
                    {message.subject}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-t3">
                    {message.preview}
                  </span>
                </span>
              </button>

              <span className="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
                {message.hasAttachments && (
                  <Paperclip className="h-3.5 w-3.5 text-t3" aria-label="Tem anexos" />
                )}
                <StarButton message={message} />
              </span>
            </div>
          </li>
        ))}

        {messages.length === 0 && (
          <li className="py-s3 text-center text-desc text-t3">
            {query.length > 0 ? 'Nenhuma mensagem corresponde.' : 'Nada nesta pasta.'}
          </li>
        )}
      </ul>

      <p className="flex-shrink-0 text-cap text-t3">
        {isSimulated
          ? `Caixa simulada — ${providerName}. Configure o correio real em Personalização → Correio.`
          : `Correio real — ${providerName}. Só a caixa de entrada é lida.`}
      </p>
    </div>
  );
}

function Reading({
  message,
  onBack,
}: {
  readonly message: MailMessage;
  readonly onBack: () => void;
}): React.JSX.Element {
  return (
    <article className="flex h-full flex-col gap-s2">
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border border-line px-2.5 py-1.5',
            'text-[12px] text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:text-accent active:scale-[.98] compact:min-h-[44px]',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar
        </button>

        <span className="ml-auto flex items-center gap-2">
          {message.hasAttachments && (
            <Paperclip className="h-3.5 w-3.5 text-t3" aria-label="Tem anexos" />
          )}
          <StarButton message={message} />
        </span>
      </div>

      <header className="flex-shrink-0 border-b border-line pb-s2">
        <h3 className="text-[14px] font-medium leading-snug">{message.subject}</h3>
        <p className="mt-1 text-[11.5px] text-t3">
          {message.from} · {message.fromAddress}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-t3">
          <span>
            {formatShortDate(new Date(message.receivedAt))} às{' '}
            {formatTime(new Date(message.receivedAt))}
          </span>
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[10px]',
              message.priority === 'acao'
                ? 'bg-warn/[.12] text-warn'
                : 'bg-accent/[.1] text-accent',
            )}
          >
            {MAIL_PRIORITY_LABELS[message.priority]}
          </span>
        </p>
      </header>

      {/* `whitespace-pre-line` preserva os parágrafos do corpo sem interpretar
          HTML — um corpo de email é conteúdo externo e não se injeta. */}
      <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-[12.5px] leading-[1.65] text-t2">
        {message.body}
      </div>

      {message.attachments.length > 0 && (
        <div className="flex-shrink-0 border-t border-line pt-s2">
          <AttachmentList attachments={message.attachments} />
        </div>
      )}

      <p className="flex-shrink-0 text-cap text-t3">
        Responder diretamente continua fora de âmbito — use «Nova mensagem» para escrever.
      </p>
    </article>
  );
}

/**
 * Rascunho novo — anexar um ficheiro (nome, tamanho e pré-visualização) e
 * enviar. Enviar só está ligado com um provedor real configurado
 * (`isSimulated` falso); com o simulado o botão fica desligado, e o rodapé
 * diz onde configurar. O diálogo nativo de ficheiro tenta primeiro
 * (`pickAttachmentsNative`); sem Tauri, cai para o `<input type="file">`
 * escondido, o mesmo padrão da cópia de segurança.
 */
function Compose({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const send = useMailStore((s) => s.send);
  const isSimulated = useMailStore((s) => s.snapshot?.isSimulated ?? true);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<readonly DraftAttachment[]>([]);
  const [isSending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // As pré-visualizações são blob URLs — sem isto, cancelar ou fechar o
  // rascunho com anexos por remover deixava-as vivas até fechar a página
  // inteira. `attachmentsRef` guarda a lista mais recente para o cleanup
  // (que só corre uma vez, ao desmontar) não ver a lista vazia do primeiro
  // render — atualizado num efeito próprio, nunca durante o render.
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, []);

  const onAttach = async (): Promise<void> => {
    const picked = await pickAttachmentsNative();
    if (picked) {
      setAttachments((prev) => [...prev, ...picked]);
      return;
    }
    // Sem diálogo nativo (browser): abre o seletor escondido do input.
    fileInputRef.current?.click();
  };

  const onFileInputChange = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...attachmentsFromFileList(files)]);
  };

  const removeAttachment = (id: string): void => {
    setAttachments((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const canSend = !isSimulated && !isSending && to.trim().length > 0;

  const handleSend = async (): Promise<void> => {
    setSending(true);
    setSendError(null);
    try {
      await send({ to: to.trim(), subject, body });
      onClose();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Não deu para enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <article className="flex h-full flex-col gap-s2">
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border border-line px-2.5 py-1.5',
            'text-[12px] text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:text-accent active:scale-[.98] compact:min-h-[44px]',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Cancelar
        </button>
        <h3 className="text-[13px] font-medium">Nova mensagem</h3>
      </div>

      <div className="flex-shrink-0 space-y-1.5">
        <input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="Para"
          aria-label="Para"
          className="w-full rounded-input border border-line bg-tint/[.03] px-2.5 py-2 text-[12.5px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
        />
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Assunto"
          aria-label="Assunto"
          className="w-full rounded-input border border-line bg-tint/[.03] px-2.5 py-2 text-[12.5px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
        />
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escreva a mensagem…"
        aria-label="Corpo da mensagem"
        className="min-h-0 flex-1 resize-none rounded-input border border-line bg-tint/[.03] p-2.5 text-[12.5px] leading-[1.6] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
      />

      {attachments.length > 0 && (
        <ul className="flex flex-shrink-0 flex-wrap gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-input border border-line bg-tint/[.03] py-1 pl-1.5 pr-2"
            >
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="h-8 w-8 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-tint/[.06] text-t3">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block max-w-[160px] truncate text-[11.5px]">
                  {attachment.name}
                </span>
                <span className="block text-[10px] text-t3">
                  {formatBytes(attachment.sizeBytes)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`Remover anexo ${attachment.name}`}
                className="ml-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-t3 transition-colors duration-hover hover:bg-danger/[.1] hover:text-danger"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void onAttach()}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border border-line px-2.5 py-1.5',
            'text-[12px] text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:text-accent active:scale-[.98] compact:min-h-[44px]',
          )}
        >
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          Anexar
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => onFileInputChange(event.target.files)}
        />
        <span className="flex-1" />
        <button
          type="button"
          disabled={!canSend}
          title={
            isSimulated
              ? 'Enviar exige um provedor real — configure o correio em Personalização → Correio.'
              : to.trim().length === 0
                ? 'Indique o destinatário.'
                : undefined
          }
          onClick={() => void handleSend()}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border px-3 py-2 text-[12px] font-medium',
            'transition-all duration-hover ease-out',
            canSend
              ? 'border-accent/50 bg-accent/[.1] text-accent hover:bg-accent/[.16] active:scale-[.98]'
              : 'cursor-not-allowed border-line bg-tint/[.03] text-t3 opacity-50',
          )}
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {isSending ? 'A enviar…' : 'Enviar'}
        </button>
      </div>

      {sendError && (
        <p
          className="flex flex-shrink-0 items-start gap-1.5 text-[11px] text-warn"
          role="alert"
        >
          {sendError}
        </p>
      )}

      <p className="flex-shrink-0 text-cap text-t3">
        {isSimulated
          ? 'Enviar exige um provedor de envio real — configure o correio em Personalização → Correio. O rascunho não é guardado ao sair.'
          : 'O remetente é a conta configurada; os anexos do rascunho não seguem na mensagem.'}
      </p>
    </article>
  );
}

function StarButton({ message }: { readonly message: MailMessage }): React.JSX.Element {
  const toggleStar = useMailStore((s) => s.toggleStar);

  return (
    <button
      type="button"
      onClick={() => void toggleStar(message.id)}
      aria-label={message.isStarred ? 'Retirar dos favoritos' : 'Marcar como favorito'}
      aria-pressed={message.isStarred}
      className="rounded p-0.5 transition-colors duration-hover hover:text-accent"
    >
      <Star
        className={cn('h-3.5 w-3.5', message.isStarred ? 'fill-warn text-warn' : 'text-t3')}
        aria-hidden="true"
      />
    </button>
  );
}

interface FolderTabProps {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
  readonly count?: number;
}

function FolderTab({
  isActive,
  onClick,
  icon: Icon,
  label,
  count,
}: FolderTabProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-input border px-2.5 py-2 text-[12px] transition-all duration-hover ease-out',
        isActive
          ? 'border-accent bg-accent/[.08] text-accent'
          : 'border-line text-t2 hover:border-accent/35 hover:text-accent',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="mono rounded-full bg-accent/[.14] px-1.5 text-[10px] text-accent">
          {count}
        </span>
      )}
    </button>
  );
}
