import { createId } from '@/lib/id';
import { ALL_EVENTS, eventBus, EVENT_LABELS, type SystemEventName } from './event-bus';

/**
 * Registo do sistema (Parte 16 §Logs, Parte 14 §Auditoria).
 *
 * Um só sítio para as duas coisas, porque são a mesma coisa vista de ângulos
 * diferentes: o Developer Center quer saber o que aconteceu para diagnosticar,
 * e o painel de privacidade quer saber o que aconteceu para prestar contas.
 * Dois registos paralelos divergiriam, e o segundo seria sempre o menos
 * completo.
 *
 * Fica todo em memória. Escrever para ficheiro exige o `fs` do Tauri —
 * bloqueado até haver PC — e guardar um registo de auditoria no `localStorage`,
 * onde qualquer script da página lhe mexe, seria pior do que não o guardar.
 */

export type LogLevel = 'debug' | 'info' | 'aviso' | 'erro';

export const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'Detalhe',
  info: 'Informação',
  aviso: 'Aviso',
  erro: 'Erro',
};

export type LogSource =
  | 'sistema'
  | 'plataforma'
  | 'evento'
  | 'voz'
  | 'automacao'
  | 'plugin'
  | 'auditoria';

export const SOURCE_LABELS: Record<LogSource, string> = {
  sistema: 'Sistema',
  plataforma: 'Plataforma',
  evento: 'Eventos',
  voz: 'Voz',
  automacao: 'Automações',
  plugin: 'Plugins',
  auditoria: 'Auditoria',
};

export interface LogEntry {
  readonly id: string;
  readonly at: number;
  readonly level: LogLevel;
  readonly source: LogSource;
  readonly message: string;
  /** Contexto extra, já em texto. `null` quando não há. */
  readonly detail: string | null;
}

/**
 * Quantas entradas ficam na memória.
 *
 * Um registo que cresce sem limite acaba por ser o próprio problema de
 * desempenho que devia ajudar a diagnosticar.
 */
export const LOG_LIMIT = 400;

type Listener = () => void;

export class LogService {
  private entries: readonly LogEntry[] = [];
  private readonly listeners = new Set<Listener>();
  private unsubscribeBus: (() => void)[] = [];

  get list(): readonly LogEntry[] {
    return this.entries;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  log(level: LogLevel, source: LogSource, message: string, detail?: string): LogEntry {
    const entry: LogEntry = {
      id: createId('log'),
      at: Date.now(),
      level,
      source,
      message,
      detail: detail ?? null,
    };

    this.entries = [entry, ...this.entries].slice(0, LOG_LIMIT);
    for (const listener of [...this.listeners]) listener();
    return entry;
  }

  /**
   * Regista uma ação para prestação de contas (Parte 14).
   *
   * Separado do `log` comum de propósito: uma linha de auditoria diz quem fez
   * o quê e como correu, e é isso que o painel de privacidade mostra. Uma
   * mensagem de diagnóstico não serve para isso.
   */
  audit(action: string, result: 'permitido' | 'recusado' | 'executado', detail?: string): LogEntry {
    return this.log(
      result === 'recusado' ? 'aviso' : 'info',
      'auditoria',
      `${action} — ${result}`,
      detail,
    );
  }

  /**
   * Passa a registar tudo o que anda no Event Bus.
   *
   * É o "inspetor de eventos" da Parte 16 sem inventar mecanismo nenhum: os
   * eventos já existem e já são tipados; isto só os escuta a todos.
   */
  watchEventBus(): () => void {
    this.stopWatching();

    for (const event of ALL_EVENTS) {
      this.unsubscribeBus.push(
        eventBus.on(event, (payload: unknown) => {
          this.log('debug', 'evento', EVENT_LABELS[event], describePayload(event, payload));
        }),
      );
    }

    return () => this.stopWatching();
  }

  clear(): void {
    this.entries = [];
    for (const listener of [...this.listeners]) listener();
  }

  private stopWatching(): void {
    for (const off of this.unsubscribeBus.splice(0)) off();
  }
}

/** O conteúdo de um evento, em texto legível. */
function describePayload(event: SystemEventName, payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const parts = Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');

  return parts.length > 0 ? `${event} — ${parts}` : event;
}

export const logService = new LogService();

/** Filtra por nível, origem e texto. Pura, para se testar sem montar nada. */
export function filterLogs(
  entries: readonly LogEntry[],
  filters: {
    readonly levels?: ReadonlySet<LogLevel>;
    readonly sources?: ReadonlySet<LogSource>;
    readonly query?: string;
  },
): readonly LogEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? '';

  return entries.filter((entry) => {
    if (filters.levels && filters.levels.size > 0 && !filters.levels.has(entry.level)) return false;
    if (filters.sources && filters.sources.size > 0 && !filters.sources.has(entry.source)) {
      return false;
    }
    if (query.length === 0) return true;

    return `${entry.message} ${entry.detail ?? ''}`.toLowerCase().includes(query);
  });
}
