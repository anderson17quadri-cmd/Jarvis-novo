import { getPlatformAdapter } from '@/platform';
import { aiService } from './ai-service';
import { memoryService } from './assistant/memory-service';
import { automationService } from './automation-service';
import { fpsMeter } from './fps-meter';
import { logService } from './log-service';
import { soundService } from './sound-service';
import { systemService } from './system-service';

/**
 * Diagnóstico (Parte 16).
 *
 * Lê o estado real das peças em vez de o inventar. Onde o browser não sabe
 * responder — a memória do processo, por exemplo — devolve `null`, e a
 * interface diz "não disponível" em vez de mostrar um zero.
 */

export interface ServiceStatus {
  readonly name: string;
  readonly state: 'ativo' | 'parado' | 'indisponível';
  readonly detail: string;
}

export interface Diagnostics {
  /** Milissegundos desde que a página abriu. */
  readonly uptimeMs: number;
  /** Tempo até o primeiro pintar, em ms. `null` se o browser não o expuser. */
  readonly firstPaintMs: number | null;
  /** Memória do heap em bytes. Só no Chromium; `null` nos outros. */
  readonly heapUsedBytes: number | null;
  readonly heapLimitBytes: number | null;
  /**
   * `null` durante o primeiro segundo de medição, ou se nada estiver a
   * observar (ver `fps-meter.ts`) — nunca um número por adivinhar.
   */
  readonly fps: number | null;
  readonly services: readonly ServiceStatus[];
}

interface MemoryInfo {
  readonly usedJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

function readMemory(): MemoryInfo | null {
  if (typeof performance === 'undefined') return null;
  // `performance.memory` é do Chromium e não está nos tipos padrão.
  const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
  return memory ?? null;
}

function readFirstPaint(): number | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return null;
  }

  const [paint] = performance.getEntriesByType('paint');
  return paint ? Math.round(paint.startTime) : null;
}

export function readDiagnostics(): Diagnostics {
  const memory = readMemory();
  const adapter = getPlatformAdapter();

  return {
    uptimeMs: typeof performance === 'undefined' ? 0 : Math.round(performance.now()),
    firstPaintMs: readFirstPaint(),
    heapUsedBytes: memory?.usedJSHeapSize ?? null,
    heapLimitBytes: memory?.jsHeapSizeLimit ?? null,
    fps: fpsMeter.current,
    services: [
      {
        name: 'Plataforma',
        state: 'ativo',
        detail: `${adapter.info.kind}${adapter.info.osName ? ` · ${adapter.info.osName}` : ''}`,
      },
      {
        name: 'Métricas do sistema',
        state: systemService.isSupported ? 'ativo' : 'indisponível',
        detail: systemService.isSupported
          ? `sondagem a cada ${systemService.pollIntervalMs / 1000}s`
          : 'a plataforma não as expõe',
      },
      {
        name: 'Automações',
        state: automationService.list.some((rule) => rule.isEnabled) ? 'ativo' : 'parado',
        detail: `${automationService.list.filter((rule) => rule.isEnabled).length} de ${automationService.list.length} ligadas`,
      },
      {
        name: 'Som',
        state: soundService.isEnabled ? 'ativo' : 'parado',
        detail: soundService.isEnabled
          ? `volume a ${Math.round(soundService.currentVolume * 100)}%`
          : 'desligado nas preferências',
      },
      {
        name: 'Assistente',
        // O provedor de regras responde a sério ao contexto, mas não é um
        // modelo de linguagem — o painel diz qual está ligado, não "IA: ativa".
        state: 'ativo',
        detail: `provedor ${aiService.providerName} · ${memoryService.current.recentPrompts.length} pedidos em memória`,
      },
      {
        name: 'Registo',
        state: 'ativo',
        detail: `${logService.list.length} entradas em memória`,
      },
    ],
  };
}
