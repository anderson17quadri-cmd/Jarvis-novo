import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Download,
  History,
  Mic,
  Plus,
  RefreshCw,
  Send,
  Star,
  User,
} from 'lucide-react';

import { USER_FIRST_NAME } from '@/constants/user';
import { useElementWidth } from '@/hooks/use-element-width';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/cn';
import { aiService, type PendingConfirmation } from '@/services/ai-service';
import { greetingFor, readContext } from '@/services/assistant/context';
import { notificationService } from '@/services/notification-service';
import { memoryService } from '@/services/assistant/memory-service';
import {
  selectActiveConversation,
  selectMessages,
  useAssistantStore,
} from '@/stores/use-assistant-store';
import type { AssistantMessage } from '@/types/assistant';
import { conversationToMarkdown, downloadText, exportFileName } from './export';
import HistoryPanel from './HistoryPanel';

/** Abaixo desta largura, a conversa e o histórico não cabem lado a lado. */
const SIDE_BY_SIDE_MIN_WIDTH = 560;

/**
 * Janela do assistente (Parte 7).
 *
 * Desenha a conversa ativa e envia o que se escreve. Quem trata da resposta é o
 * `AIService`, quem trata do modo do núcleo é o store, e quem guarda o histórico
 * são as conversas — a janela não decide nenhuma das três coisas.
 */
export default function AssistantWindow(): React.JSX.Element {
  const messages = useAssistantStore(selectMessages);
  const conversation = useAssistantStore(selectActiveConversation);
  const mode = useAssistantStore((state) => state.mode);
  const addMessage = useAssistantStore((state) => state.addMessage);
  const startConversation = useAssistantStore((state) => state.startConversation);
  const toggleFavourite = useAssistantStore((state) => state.toggleFavourite);

  const [isHistoryOpen, setHistoryOpen] = useState(false);

  // O layout decide-se pela largura da janela, não pela do ecrã: uma janela de
  // 400px é apertada mesmo num monitor grande. Abaixo do limite, o histórico
  // ocupa a janela toda em vez de espremer a conversa para 200px.
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const isNarrow = width > 0 && width < SIDE_BY_SIDE_MIN_WIDTH;

  // O mesmo microfone do header: o executor é um só, registado pela App.
  const { isSupported: isVoiceSupported, toggleListening } = useVoice();

  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A saudação só entra se a conversa estiver mesmo vazia — reabrir a janela
  // não deve repetir o cumprimento por cima do histórico.
  useEffect(() => {
    if (selectMessages(useAssistantStore.getState()).length === 0) {
      addMessage('assistant', greeting());
    }
    inputRef.current?.focus();
  }, [addMessage]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  /** Ferramentas destrutivas à espera de resposta. */
  const [pending, setPending] = useState<readonly PendingConfirmation[]>([]);

  const send = useCallback((): void => {
    const text = draft.trim();
    if (text.length === 0) return;

    setDraft('');
    // `sendWithTools` cai num envio normal quando o provedor não sabe pedir
    // ferramentas — a janela não precisa de saber qual está ligado.
    void aiService.sendWithTools(text).then((waiting) => {
      setPending(waiting);

      // A pergunta vive dentro desta janela, e esta janela pode ter ficado
      // atrás de outra. Um aviso aparece por cima de tudo — sem ele, uma ação
      // destrutiva ficava à espera sem ninguém saber.
      if (waiting.length > 0) {
        notificationService.warn(
          'O assistente está à espera de si',
          waiting.length === 1
            ? 'Há uma ação que não se pode desfazer por confirmar.'
            : `Há ${waiting.length} ações que não se podem desfazer por confirmar.`,
          { category: 'assistente' },
        );
      }
    });
  }, [draft]);

  const isBusy = mode === 'thinking' || mode === 'speaking';

  return (
    <div ref={rootRef} className="flex h-full min-h-0 gap-s2">
      {/* Com espaço, o histórico é uma coluna ao lado; sem ele, toma a janela. */}
      {isHistoryOpen &&
        (isNarrow ? (
          <div className="min-h-0 flex-1">
            <HistoryPanel onClose={() => setHistoryOpen(false)} />
          </div>
        ) : (
          <aside className="min-h-0 w-[220px] flex-shrink-0 border-r border-line pr-s2">
            <HistoryPanel />
          </aside>
        ))}

      {!(isNarrow && isHistoryOpen) && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-s2 flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-pressed={isHistoryOpen}
              aria-label="Histórico de conversas"
              className={cn(
                'flex items-center gap-1.5 rounded-input border px-2.5 py-1.5 text-[11.5px]',
                'transition-all duration-hover ease-out',
                isHistoryOpen
                  ? 'border-accent bg-accent/[.08] text-accent'
                  : 'border-line text-t2 hover:border-accent/35 hover:text-accent',
              )}
            >
              <History className="h-3 w-3" aria-hidden="true" />
              Histórico
            </button>

            <span className="min-w-0 flex-1 truncate px-1 text-[11px] text-t3">
              {conversation?.title}
            </span>

            {conversation && conversation.messages.length > 0 && (
              <HeaderAction
                label="Exportar esta conversa"
                onClick={() =>
                  downloadText(exportFileName(conversation), conversationToMarkdown(conversation))
                }
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </HeaderAction>
            )}

            <HeaderAction label="Nova conversa" onClick={() => startConversation()}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </HeaderAction>
          </div>

          <div
            ref={logRef}
            role="log"
            aria-label="Conversa"
            className="mb-s2 flex flex-1 flex-col gap-3.5 overflow-y-auto"
          >
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                // Só a última resposta se regenera: refazer uma do meio
                // apagaria tudo o que veio depois sem o dizer.
                canRegenerate={
                  message.author === 'assistant' && index === messages.length - 1 && !isBusy
                }
                onToggleFavourite={() => toggleFavourite(message.id)}
                onRegenerate={() => void aiService.regenerate(message.id)}
              />
            ))}
          </div>

          {pending.length > 0 && (
            <div className="mb-s2 flex flex-shrink-0 flex-col gap-1.5">
              {pending.map((entry) => (
                <ConfirmRow
                  key={entry.call.id}
                  question={entry.question}
                  onConfirm={() => {
                    aiService.confirmTool(entry.call);
                    setPending((rest) => rest.filter((item) => item.call.id !== entry.call.id));
                  }}
                  onCancel={() =>
                    setPending((rest) => rest.filter((item) => item.call.id !== entry.call.id))
                  }
                />
              ))}
            </div>
          )}

          <div
            className={cn(
              'flex h-[52px] flex-shrink-0 items-center gap-2 rounded-input border border-line',
              'bg-tint/[.03] py-0 pl-4 pr-2 transition-[border-color,box-shadow] duration-200',
              'focus-within:border-accent/[.42] focus-within:shadow-[0_0_0_4px_rgba(0,207,255,.06)]',
            )}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') send();
              }}
              placeholder="Escreva ou fale um comando"
              aria-label="Comando para o assistente"
              className="min-w-0 flex-1 bg-transparent text-desc outline-none placeholder:text-t3"
            />

            {/* O microfone só aparece onde há reconhecimento de voz. */}
            {isVoiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={mode === 'listening' ? 'Desligar microfone' : 'Ligar microfone'}
                aria-pressed={mode === 'listening'}
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-line text-t2',
                  'transition-all duration-hover ease-out hover:border-accent/35 hover:text-accent',
                  mode === 'listening' && 'border-danger/35 bg-danger/[.12] text-danger',
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={send}
              aria-label="Enviar"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-[#04121A] transition-all duration-hover ease-out hover:shadow-glow"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Saudação de abertura, montada com o que se sabe mesmo.
 *
 * A versão anterior era uma frase fixa que falava de três emails e de um
 * compromisso às 10:00 — nenhum dos dois existia. Esta só diz o que é verdade.
 */
function greeting(): string {
  const context = readContext();
  const name = memoryService.current.preferences['nome'] ?? context?.userName ?? null;
  const hour = context?.now.getHours() ?? new Date().getHours();

  const opening = `${greetingFor(hour)}${name !== null ? `, ${name}` : ''}.`;

  if (context === null) return `${opening} Diga o que precisa.`;

  const pending: string[] = [];
  if (context.unreadNotifications > 0) {
    pending.push(
      context.unreadNotifications === 1
        ? 'uma notificação por ler'
        : `${context.unreadNotifications} notificações por ler`,
    );
  }
  if (context.openWindows.length > 0) {
    pending.push(
      context.openWindows.length === 1
        ? 'uma janela aberta'
        : `${context.openWindows.length} janelas abertas`,
    );
  }

  return pending.length === 0
    ? `${opening} Está tudo calmo. Diga o que precisa.`
    : `${opening} Tem ${pending.join(' e ')}.`;
}

function ChatMessage({
  message,
  canRegenerate,
  onToggleFavourite,
  onRegenerate,
}: {
  readonly message: AssistantMessage;
  readonly canRegenerate: boolean;
  readonly onToggleFavourite: () => void;
  readonly onRegenerate: () => void;
}): React.JSX.Element {
  const isAssistant = message.author === 'assistant';
  const Icon = isAssistant ? Bot : User;

  return (
    <article className="group flex gap-[11px] motion-safe:animate-window-in">
      <span
        className={cn(
          'flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg border',
          isAssistant
            ? 'border-accent/25 bg-accent/[.12] text-accent'
            : 'border-line bg-tint/5 text-t2',
        )}
        aria-hidden="true"
      >
        <Icon className="h-[13px] w-[13px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-t3">
            {isAssistant ? 'Jarvis' : USER_FIRST_NAME}
          </span>

          {/*
            Que modelo respondeu (Parte 12 §Seleção automática).

            Discreto, mas sempre à vista: com a escolha por pedido ligada, é a
            única forma de saber que uma resposta foi ao modelo caro.
          */}
          {message.model !== undefined && (
            <span className="truncate text-[10px] text-t3" title={message.model}>
              {message.model}
            </span>
          )}

          <span
            className={cn(
              'flex items-center gap-px transition-opacity duration-hover',
              // A estrela de uma favorita fica sempre à vista: é o que
              // distingue a mensagem quando não se está a passar o rato.
              message.isFavourite ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
            )}
          >
            <button
              type="button"
              onClick={onToggleFavourite}
              aria-label={message.isFavourite ? 'Tirar dos favoritos' : 'Marcar como favorita'}
              aria-pressed={message.isFavourite}
              className={cn(
                'rounded p-0.5 transition-colors duration-hover',
                message.isFavourite ? 'text-accent' : 'text-t3 hover:text-accent',
              )}
            >
              <Star className={cn('h-3 w-3', message.isFavourite && 'fill-current')} />
            </button>

            {canRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                aria-label="Gerar outra resposta"
                className="rounded p-0.5 text-t3 transition-colors duration-hover hover:text-accent"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </span>
        </div>

        <p className={cn('text-desc leading-[1.62]', isAssistant ? 'text-t1' : 'text-t2')}>
          {message.text}
          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-[14px] w-[7px] translate-y-[2px] bg-accent motion-safe:animate-blink" />
          )}
        </p>
      </div>
    </article>
  );
}

/**
 * Uma ferramenta que perde dados, à espera de resposta.
 *
 * Fica **por cima do campo de escrita**, e não num diálogo por cima de tudo:
 * um diálogo modal interrompe; isto espera. E deixa-se ignorar — não responder
 * é não fazer, que é o resultado mais seguro.
 */
function ConfirmRow({
  question,
  onConfirm,
  onCancel,
}: {
  readonly question: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  return (
    <div
      role="alertdialog"
      aria-label="Confirmar ação"
      className="flex items-start gap-2 rounded-input border border-warn/40 bg-warn/[.07] p-2.5"
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />

      <span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-t2">{question}</span>

      <span className="flex flex-shrink-0 gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-btn border border-line px-2.5 py-1 text-[11px] text-t2 transition-colors duration-hover hover:text-t1"
        >
          Não
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-btn border border-danger/50 bg-danger/[.12] px-2.5 py-1 text-[11px] text-danger transition-colors duration-hover hover:bg-danger/20"
        >
          Sim, fazer
        </button>
      </span>
    </div>
  );
}

function HeaderAction({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-accent"
    >
      {children}
    </button>
  );
}
