import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useShallow } from 'zustand/react/shallow';

import { useDataService } from '@/hooks/use-data-service';
import { mailService } from '@/services/mail/mail-service';
import { newsService } from '@/services/news/news-service';
import { useNotificationStore } from '@/stores/use-notification-store';
import { buildCommands, filterCommands, type CommandActions } from './command-registry';

interface CommandPaletteProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly actions: CommandActions;
}

/**
 * Paleta de comandos (CTRL+K).
 *
 * Navegável só com o teclado: setas para percorrer, Enter para executar, Escape
 * para sair. A seleção acompanha o scroll, para não se perder de vista.
 */
export function CommandPalette({ isOpen, onClose, actions }: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // O conteúdo pesquisável vem dos serviços, e muda a cada sondagem.
  const { data: mailbox } = useDataService(mailService);
  const { data: feed } = useDataService(newsService);
  const notifications = useNotificationStore(useShallow((state) => state.notifications));

  const commands = useMemo(
    () =>
      buildCommands({
        mail: mailbox?.messages ?? [],
        news: feed?.articles ?? [],
        notifications,
      }),
    [feed, mailbox, notifications],
  );
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  // Cada abertura começa do zero — reabrir com a pesquisa anterior confunde.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Uma pesquisa nova pode encurtar a lista abaixo do índice selecionado.
  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-command-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const execute = (index: number): void => {
    const command = results[index];
    if (!command) return;
    onClose();
    // Adiado um tick: deixa a paleta fechar antes de o comando abrir uma janela.
    setTimeout(() => command.run(actions), 60);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % Math.max(1, results.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + results.length) % Math.max(1, results.length));
        break;
      case 'Enter':
        event.preventDefault();
        execute(selectedIndex);
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  let lastGroup = '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'fixed inset-0 z-palette flex items-start justify-center bg-[rgb(3_6_10_/_0.6)] backdrop-blur-[6px]',
        'px-5 pb-5 pt-[12vh] motion-safe:animate-window-in',
      )}
    >
      <div className="w-[min(620px,100%)] overflow-hidden rounded-modal border border-line-2 bg-[rgb(16_25_34_/_0.9)] shadow-2 backdrop-blur-glass">
        <div className="flex h-[58px] items-center gap-3 border-b border-line px-5">
          <Search className="h-[18px] w-[18px] flex-shrink-0 text-t3" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Pesquisar comandos, emails, notícias, janelas, temas…"
            aria-label="Pesquisar comandos"
            aria-controls="command-results"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-t3"
          />
        </div>

        <div
          ref={listRef}
          id="command-results"
          role="listbox"
          aria-label="Resultados"
          className="max-h-[min(420px,52vh)] overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <p className="p-7 text-center text-[13.5px] text-t3">
              Nenhum resultado. Tente outro termo.
            </p>
          ) : (
            results.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              const Icon = command.icon;

              return (
                <div key={command.id}>
                  {showGroup && (
                    <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-t3">
                      {command.group}
                    </div>
                  )}

                  <button
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    data-command-index={index}
                    onClick={() => execute(index)}
                    onPointerEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-[13px] rounded-xl px-3 py-[11px] text-t2',
                      'transition-colors duration-hover',
                      index === selectedIndex && 'bg-accent/10 text-accent',
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] flex-shrink-0 opacity-80" aria-hidden="true" />
                    <span className="flex-1 text-left text-desc">{command.label}</span>
                    <span className="text-[11px] text-t3">{command.hint}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
