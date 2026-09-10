import { useMemo, useState, useSyncExternalStore } from 'react';
import { Brain, Download, MessageSquare, Pin, PinOff, Star, Trash2, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { MEMORY_LABELS, memoryService } from '@/services/assistant/memory-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AssistantConversation } from '@/types/assistant';
import {
  groupConversations,
  onlyWithFavourites,
  searchConversations,
} from './conversation-history';
import { conversationToMarkdown, downloadText, exportFileName } from './export';

type Tab = 'conversas' | 'memoria';

/**
 * Histórico e memória (Partes 7.1 e 7.2).
 *
 * Conversas agrupadas por tempo, com fixar, exportar, apagar e um filtro de
 * favoritas; e o que a memória local guardou, com o botão de esquecer ao lado
 * de cada coisa — se não se pode apagar, não é memória, é um registo.
 */
export default function HistoryPanel({
  onClose,
}: {
  /** No compacto o painel é uma gaveta e precisa de fechar. */
  readonly onClose?: () => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('conversas');

  return (
    <div role="region" aria-label="Conversas guardadas" className="flex h-full flex-col gap-2">
      <div className="flex flex-shrink-0 items-center gap-1">
        <TabButton isActive={tab === 'conversas'} onClick={() => setTab('conversas')}>
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          Conversas
        </TabButton>
        <TabButton isActive={tab === 'memoria'} onClick={() => setTab('memoria')}>
          <Brain className="h-3 w-3" aria-hidden="true" />
          Memória
        </TabButton>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar o histórico"
            className="ml-auto rounded p-1 text-t3 transition-colors duration-hover hover:text-t1"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {tab === 'conversas' ? <ConversationList /> : <MemoryList />}
    </div>
  );
}

function ConversationList(): React.JSX.Element {
  const conversations = useAssistantStore((state) => state.conversations);
  const activeId = useAssistantStore((state) => state.activeId);
  const select = useAssistantStore((state) => state.selectConversation);
  const togglePinned = useAssistantStore((state) => state.togglePinned);
  const remove = useAssistantStore((state) => state.removeConversation);

  const [query, setQuery] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const groups = useMemo(() => {
    const filtered = searchConversations(
      favouritesOnly ? onlyWithFavourites(conversations) : conversations,
      query,
    );
    return groupConversations(filtered);
  }, [conversations, favouritesOnly, query]);

  const isEmpty = groups.length === 0;

  return (
    <>
      <label className="flex-shrink-0">
        <span className="sr-only">Pesquisar nas conversas</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar…"
          className={cn(
            'w-full rounded-input border border-line bg-tint/[.03] px-2.5 py-1.5',
            'text-[11.5px] outline-none transition-colors duration-hover',
            'placeholder:text-t3 focus:border-accent/45',
          )}
        />
      </label>

      <button
        type="button"
        aria-pressed={favouritesOnly}
        onClick={() => setFavouritesOnly((value) => !value)}
        className={cn(
          'flex flex-shrink-0 items-center gap-1.5 self-start rounded-full border px-2 py-0.5',
          'text-[10.5px] transition-all duration-hover ease-out',
          favouritesOnly
            ? 'border-accent/60 bg-accent/[.1] text-accent'
            : 'border-line text-t3 hover:border-accent/30 hover:text-t2',
        )}
      >
        <Star className="h-3 w-3" aria-hidden="true" />
        Só favoritas
      </button>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
        {groups.map((group) => (
          <section key={group.label}>
            <p className="t-label mb-1">{group.label}</p>
            <ul className="space-y-0.5">
              {group.conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeId}
                  onSelect={() => select(conversation.id)}
                  onTogglePinned={() => togglePinned(conversation.id)}
                  onRemove={() => remove(conversation.id)}
                />
              ))}
            </ul>
          </section>
        ))}

        {isEmpty && (
          <p className="py-s3 text-center text-[11.5px] text-t3">
            {conversations.some((entry) => entry.messages.length > 0)
              ? 'Nada corresponde à pesquisa.'
              : 'Ainda não há conversas guardadas.'}
          </p>
        )}
      </div>
    </>
  );
}

function ConversationRow({
  conversation,
  isActive,
  onSelect,
  onTogglePinned,
  onRemove,
}: {
  readonly conversation: AssistantConversation;
  readonly isActive: boolean;
  readonly onSelect: () => void;
  readonly onTogglePinned: () => void;
  readonly onRemove: () => void;
}): React.JSX.Element {
  const Icon = conversation.isPinned ? PinOff : Pin;

  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-input border px-2 py-1.5 transition-colors duration-hover',
        isActive ? 'border-accent/50 bg-accent/[.07]' : 'border-transparent hover:border-line',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        className="min-w-0 flex-1 text-left"
      >
        <span className={cn('block truncate text-[11.5px]', isActive ? 'text-accent' : 'text-t1')}>
          {conversation.title}
        </span>
        <span className="block text-[10px] text-t3">
          {conversation.messages.length}{' '}
          {conversation.messages.length === 1 ? 'mensagem' : 'mensagens'}
        </span>
      </button>

      {/* Sempre no DOM, visíveis ao passar o rato: escondê-las por completo
          tirava-as também ao teclado e ao leitor de ecrã. */}
      <span className="flex flex-shrink-0 items-center gap-px opacity-0 transition-opacity duration-hover focus-within:opacity-100 group-hover:opacity-100">
        <RowAction
          label={conversation.isPinned ? 'Desafixar a conversa' : 'Fixar a conversa'}
          onClick={onTogglePinned}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
        </RowAction>
        <RowAction
          label={`Exportar "${conversation.title}"`}
          onClick={() =>
            downloadText(exportFileName(conversation), conversationToMarkdown(conversation))
          }
        >
          <Download className="h-3 w-3" aria-hidden="true" />
        </RowAction>
        <RowAction label={`Apagar "${conversation.title}"`} onClick={onRemove} isDanger>
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </RowAction>
      </span>

      {conversation.isPinned && (
        <Pin className="h-2.5 w-2.5 flex-shrink-0 text-accent" aria-label="Fixada" />
      )}
    </li>
  );
}

function MemoryList(): React.JSX.Element {
  const memory = useSyncExternalStore(
    (onChange) => memoryService.subscribe(onChange),
    () => memoryService.current,
  );

  const preferences = Object.entries(memory.preferences);

  return (
    <div className="min-h-0 flex-1 space-y-s3 overflow-y-auto">
      <section>
        <p className="t-label mb-1.5">O que sei de si</p>

        {preferences.length === 0 ? (
          <p className="text-[11.5px] leading-relaxed text-t3">
            Nada, para já. Escreva "trata-me por…" ou "moro em…" e fica guardado. Só regista o que
            for dito por palavras — não deduz nada do resto da conversa.
          </p>
        ) : (
          <ul className="space-y-1">
            {preferences.map(([key, value]) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 text-[11.5px]">
                  <span className="text-t3">{MEMORY_LABELS[key] ?? key}: </span>
                  {value}
                </span>
                <RowAction label={`Esquecer ${key}`} onClick={() => memoryService.forget(key)} isDanger>
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </RowAction>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="t-label mb-1.5">Últimos pedidos</p>

        {memory.recentPrompts.length === 0 ? (
          <p className="text-[11.5px] text-t3">Ainda não pediu nada.</p>
        ) : (
          <ol className="space-y-0.5">
            {memory.recentPrompts.map((prompt) => (
              <li key={prompt} className="truncate text-[11px] text-t2">
                {prompt}
              </li>
            ))}
          </ol>
        )}
      </section>

      {(preferences.length > 0 || memory.recentPrompts.length > 0) && (
        <button
          type="button"
          onClick={() => memoryService.clear()}
          className="text-[11px] text-t3 underline transition-colors duration-hover hover:text-danger"
        >
          Esquecer tudo
        </button>
      )}

      <p className="text-[10.5px] leading-relaxed text-t3">
        Fica no dispositivo. Não é enviada para lado nenhum — nem haveria para onde, sem provedor de
        IA ligado.
      </p>
    </div>
  );
}

function RowAction({
  label,
  onClick,
  isDanger = false,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly isDanger?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'rounded p-1 text-t3 transition-colors duration-hover',
        isDanger ? 'hover:text-danger' : 'hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}

function TabButton({
  isActive,
  onClick,
  children,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-input border px-2.5 py-1.5 text-[11.5px] font-medium',
        'transition-all duration-hover ease-out',
        isActive
          ? 'border-accent bg-accent/[.08] text-accent'
          : 'border-line text-t2 hover:border-accent/35 hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}
