import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Terminal } from 'lucide-react';

import { createId } from '@/lib/id';
import { cn } from '@/lib/cn';
import { buildCall, parseLine } from '@/services/assistant/console-parser';
import { runTool, type ToolCall } from '@/services/assistant/tool-runner';
import { TOOLS } from '@/services/assistant/tools';
import { formatTime } from '@/lib/format';

/**
 * Consola de comandos (Parte 16 §Consola de comandos).
 *
 * Corre pelo mesmo `runTool` que o assistente usa quando o modelo pede uma
 * ferramenta — a linha aqui escrita é literalmente uma chamada, sem o modelo
 * pelo meio. É por isso que vive no Centro de Programador, e não algures na
 * interface pensada para quem só quer usar o sistema.
 *
 * `ajuda` lista o catálogo; `ajuda <nome>` detalha uma ferramenta; `limpar`
 * esvazia o histórico. Tudo o resto vai a `parseLine` → `buildCall` →
 * `runTool`, e o resultado fica na consola, nunca escondido.
 */

interface HistoryEntry {
  readonly id: string;
  readonly command: string;
  readonly at: number;
  readonly lines: readonly string[];
  readonly tone: 'ok' | 'erro' | 'info';
  /** Presente só quando a ferramenta pediu confirmação e ainda não se decidiu. */
  readonly pending?: ToolCall;
}

const HELP_INTRO = [
  'Sintaxe: ferramenta chave=valor chave2="valor com espaços".',
  '"ajuda <ferramenta>" mostra os parâmetros. "limpar" esvazia isto.',
  '',
  ...TOOLS.map((tool) => `${tool.name}${tool.risk === 'perde' ? ' ⚠' : ''} — ${tool.description}`),
];

export function CommandConsole(): React.JSX.Element {
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [history]);

  const push = (command: string, lines: readonly string[], tone: HistoryEntry['tone'], pending?: ToolCall): void => {
    setHistory((previous) => [
      ...previous,
      {
        id: createId('console'),
        command,
        at: Date.now(),
        lines,
        tone,
        ...(pending ? { pending } : {}),
      },
    ]);
  };

  /** Substitui uma entrada pendente pelo resultado — nunca deixa `pending` lá. */
  const resolve = (id: string, lines: readonly string[], tone: HistoryEntry['tone']): void => {
    setHistory((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? { id: entry.id, command: entry.command, at: entry.at, lines, tone }
          : entry,
      ),
    );
  };

  const run = async (): Promise<void> => {
    const command = draft.trim();
    if (command.length === 0) return;

    setDraft('');
    setHistoryIndex(null);

    if (command === 'limpar') {
      setHistory([]);
      return;
    }

    if (command === 'ajuda') {
      push(command, HELP_INTRO, 'info');
      return;
    }

    if (command.startsWith('ajuda ')) {
      const name = command.slice('ajuda '.length).trim();
      const tool = TOOLS.find((entry) => entry.name === name);

      if (!tool) {
        push(command, [`Não conheço a ferramenta "${name}".`], 'erro');
        return;
      }

      push(
        command,
        [
          `${tool.name} — ${tool.description}`,
          tool.risk === 'perde' ? 'Risco: não se pode desfazer. Pede confirmação.' : 'Risco: reversível.',
          tool.parameters.length === 0
            ? 'Sem parâmetros.'
            : `Parâmetros: ${tool.parameters
                .map((p) => `${p.name}${p.required ? '' : '?'} (${p.options ? p.options.join('|') : p.type})`)
                .join(', ')}`,
        ],
        'info',
      );
      return;
    }

    const parsed = parseLine(command);
    if (!parsed.ok) {
      push(command, [parsed.problem], 'erro');
      return;
    }

    const built = buildCall(createId('console-call'), parsed.line);
    if (!built.ok) {
      push(command, [built.problem], 'erro');
      return;
    }

    const outcome = await runTool(built.call);

    if (outcome.status === 'confirmar') {
      push(command, [outcome.message], 'info', built.call);
      return;
    }

    push(command, [outcome.message], outcome.status === 'ok' ? 'ok' : 'erro');
  };

  const navigateHistory = (direction: -1 | 1): void => {
    const commands = history.map((entry) => entry.command);
    if (commands.length === 0) return;

    const nextIndex =
      historyIndex === null
        ? commands.length - 1
        : Math.min(commands.length - 1, Math.max(0, historyIndex + direction));

    setHistoryIndex(nextIndex);
    setDraft(commands[nextIndex] ?? '');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-s2">
      <div
        ref={logRef}
        className="mono min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-card border border-line bg-tint/[.02] p-3 text-[11.5px]"
        role="log"
        aria-label="Histórico da consola"
      >
        {history.length === 0 && (
          <p className="text-t3">
            Escreva um comando — por exemplo <span className="text-t2">abrir_janela app=emails</span>.
            "ajuda" lista o catálogo.
          </p>
        )}

        {history.map((entry) => (
          <div key={entry.id}>
            <div className="flex items-center gap-1.5 text-t2">
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-accent" aria-hidden="true" />
              <span>{entry.command}</span>
              <span className="ml-auto flex-shrink-0 text-[10px] text-t3">
                {formatTime(new Date(entry.at))}
              </span>
            </div>

            {entry.lines.map((line, index) => (
              <p
                key={index}
                className={cn(
                  'pl-[18px] leading-relaxed',
                  entry.tone === 'ok' && 'text-ok',
                  entry.tone === 'erro' && 'text-danger',
                  entry.tone === 'info' && 'text-t3',
                )}
              >
                {line}
              </p>
            ))}

            {entry.pending && (
              <div
                role="alertdialog"
                aria-label="Confirmar ação"
                className="ml-[18px] mt-1.5 flex items-start gap-2 rounded-input border border-warn/40 bg-warn/[.07] p-2"
              >
                <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-t2">
                  Confirma? Esta ação não se pode desfazer.
                </span>
                <span className="flex flex-shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => resolve(entry.id, ['Cancelado.'], 'info')}
                    className="rounded-btn border border-line px-2 py-1 text-[10.5px] text-t2 transition-colors duration-hover hover:text-t1"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void runTool(entry.pending!, true).then((result) => {
                        resolve(entry.id, [result.message], result.status === 'ok' ? 'ok' : 'erro');
                      });
                    }}
                    className="rounded-btn border border-danger/50 bg-danger/[.12] px-2 py-1 text-[10.5px] text-danger transition-colors duration-hover hover:bg-danger/20"
                  >
                    Sim, fazer
                  </button>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <label className="flex flex-shrink-0 items-center gap-2 rounded-input border border-line bg-tint/[.03] px-3 py-2">
        <Terminal className="h-3.5 w-3.5 flex-shrink-0 text-t3" aria-hidden="true" />
        <span className="sr-only">Comando</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void run();
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              navigateHistory(-1);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              navigateHistory(1);
            }
          }}
          placeholder="ferramenta chave=valor…"
          className="mono min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-t3"
        />
      </label>
    </div>
  );
}
