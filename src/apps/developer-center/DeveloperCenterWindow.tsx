import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Activity, ScrollText, TerminalSquare, Trash2 } from 'lucide-react';

import { useCapabilities, usePlatformInfo } from '@/hooks/use-platform';
import { CommandConsole } from './CommandConsole';
import { cn } from '@/lib/cn';
import { formatBytes, formatTime } from '@/lib/format';
import { readDiagnostics, type Diagnostics } from '@/services/diagnostics';
import {
  filterLogs,
  LEVEL_LABELS,
  logService,
  SOURCE_LABELS,
  type LogLevel,
  type LogSource,
} from '@/services/log-service';

const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: 'text-t3',
  info: 'text-accent',
  aviso: 'text-warn',
  erro: 'text-danger',
};

type Tab = 'registo' | 'estado' | 'consola';

/** De quanto em quanto tempo o diagnóstico é relido. */
const DIAGNOSTICS_INTERVAL_MS = 2_000;

/**
 * Painel de desenvolvedor (Parte 16).
 *
 * Registo em tempo real com filtros, o estado real das peças do sistema, e uma
 * consola de comandos que fala com o mesmo executor do assistente. Lê tudo do
 * que já existe — o `logService` escuta o Event Bus, o `readDiagnostics`
 * pergunta a cada serviço como está. Nada aqui é simulado; onde o browser não
 * sabe responder, aparece "não disponível".
 */
export default function DeveloperCenterWindow(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('registo');

  const entries = useSyncExternalStore(
    (onChange) => logService.subscribe(onChange),
    () => logService.list,
  );

  const [levels, setLevels] = useState<ReadonlySet<LogLevel>>(new Set());
  const [sources, setSources] = useState<ReadonlySet<LogSource>>(new Set());
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () => filterLogs(entries, { levels, sources, query }),
    [entries, levels, query, sources],
  );

  return (
    <div className="flex h-full flex-col gap-s2">
      <div role="tablist" aria-label="Vista" className="flex flex-shrink-0 gap-1">
        <TabButton isActive={tab === 'registo'} onClick={() => setTab('registo')}>
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
          Registo ({entries.length})
        </TabButton>
        <TabButton isActive={tab === 'estado'} onClick={() => setTab('estado')}>
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Estado
        </TabButton>
        <TabButton isActive={tab === 'consola'} onClick={() => setTab('consola')}>
          <TerminalSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Consola
        </TabButton>

        {tab === 'registo' && entries.length > 0 && (
          <button
            type="button"
            onClick={() => logService.clear()}
            aria-label="Limpar o registo"
            className="ml-auto rounded p-1.5 text-t3 transition-colors duration-hover hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {tab === 'consola' && <CommandConsole />}

      {tab === 'registo' && (
        <>
          <label className="flex-shrink-0">
            <span className="sr-only">Pesquisar no registo</span>
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

          <div className="flex flex-shrink-0 flex-wrap gap-1">
            {(Object.keys(LEVEL_LABELS) as LogLevel[]).map((level) => (
              <Chip
                key={level}
                isActive={levels.has(level)}
                onClick={() => setLevels(toggle(levels, level))}
              >
                {LEVEL_LABELS[level]}
              </Chip>
            ))}
          </div>

          <div className="flex flex-shrink-0 flex-wrap gap-1">
            {(Object.keys(SOURCE_LABELS) as LogSource[]).map((source) => (
              <Chip
                key={source}
                isActive={sources.has(source)}
                onClick={() => setSources(toggle(sources, source))}
              >
                {SOURCE_LABELS[source]}
              </Chip>
            ))}
          </div>

          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline gap-2 rounded border border-transparent px-1.5 py-1 hover:border-line"
              >
                <span className="mono flex-shrink-0 text-[10px] text-t3">
                  {formatTime(new Date(entry.at))}
                </span>
                <span
                  className={cn(
                    'mono w-[62px] flex-shrink-0 text-[9.5px] uppercase tracking-wide',
                    LEVEL_STYLE[entry.level],
                  )}
                >
                  {SOURCE_LABELS[entry.source]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px]">{entry.message}</span>
                  {entry.detail && (
                    <span className="mono block truncate text-[10px] text-t3">{entry.detail}</span>
                  )}
                </span>
              </li>
            ))}

            {visible.length === 0 && (
              <li className="py-s3 text-center text-desc text-t3">
                {entries.length === 0 ? 'Nada registado ainda.' : 'Nada corresponde aos filtros.'}
              </li>
            )}
          </ul>
        </>
      )}

      {tab === 'estado' && <StatePanel />}
    </div>
  );
}

function StatePanel(): React.JSX.Element {
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(() => readDiagnostics());
  const capabilities = useCapabilities();
  const info = usePlatformInfo();

  useEffect(() => {
    const timer = setInterval(() => setDiagnostics(readDiagnostics()), DIAGNOSTICS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-0 flex-1 space-y-s3 overflow-y-auto">
      <section>
        <p className="t-label mb-2">Desempenho</p>
        <dl className="space-y-1 text-[11.5px]">
          <Row term="Aberto há">{formatDuration(diagnostics.uptimeMs)}</Row>
          <Row term="Primeiro pintar">
            {diagnostics.firstPaintMs === null ? '—' : `${diagnostics.firstPaintMs} ms`}
          </Row>
          <Row term="Memória">
            {diagnostics.heapUsedBytes === null
              ? 'não disponível neste browser'
              : `${formatBytes(diagnostics.heapUsedBytes)} de ${formatBytes(diagnostics.heapLimitBytes ?? 0)}`}
          </Row>
        </dl>
      </section>

      <section>
        <p className="t-label mb-2">Serviços</p>
        <ul className="space-y-1">
          {diagnostics.services.map((service) => (
            <li
              key={service.name}
              className="flex items-baseline gap-2 rounded-input border border-line bg-tint/[.02] px-2.5 py-1.5"
            >
              <span
                className={cn(
                  'h-[6px] w-[6px] flex-shrink-0 rounded-full',
                  service.state === 'ativo' && 'bg-ok',
                  service.state === 'parado' && 'bg-t3',
                  service.state === 'indisponível' && 'bg-warn',
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-[12px]">{service.name}</span>
              <span className="text-[10.5px] text-t3">{service.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="t-label mb-2">Plataforma</p>
        <dl className="space-y-1 text-[11.5px]">
          <Row term="Tipo">{info.kind}</Row>
          <Row term="Dentro do Tauri">{info.isTauri ? 'sim' : 'não'}</Row>
          <Row term="Ecrã de toque">{info.isTouch ? 'sim' : 'não'}</Row>
        </dl>

        <p className="mb-1.5 mt-2.5 text-[11.5px] text-t3">Capacidades</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(capabilities) as (keyof typeof capabilities)[]).map((key) => (
            <span
              key={key}
              className={cn(
                'rounded-full border px-2 py-px text-[10px]',
                capabilities[key]
                  ? 'border-ok/40 text-ok'
                  : 'border-line text-t3 line-through opacity-70',
              )}
            >
              {key}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

/** "3 min 12 s". Vive aqui porque só este painel o usa. */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function toggle<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Row({
  term,
  children,
}: {
  readonly term: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex gap-2">
      <dt className="w-[110px] flex-shrink-0 text-t3">{term}</dt>
      <dd className="min-w-0 flex-1 text-t2">{children}</dd>
    </div>
  );
}

function Chip({
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
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10.5px] transition-all duration-hover ease-out',
        isActive
          ? 'border-accent/60 bg-accent/[.1] text-accent'
          : 'border-line text-t3 hover:border-accent/30 hover:text-t2',
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
        'flex items-center gap-1.5 rounded-input border px-3 py-2 text-[12.5px] font-medium',
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
