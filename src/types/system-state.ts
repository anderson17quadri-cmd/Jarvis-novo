import { Battery, Focus, Gauge, MonitorPlay, Sparkles, type LucideIcon } from 'lucide-react';

import { DEFAULT_POLL_INTERVAL_MS } from '@/services/system-service';

/** Estados do sistema (Parte 9 §Estados do sistema). */
export type SystemStateId = 'normal' | 'foco' | 'apresentacao' | 'economia' | 'performance';

/**
 * O que um estado muda.
 *
 * Só entram aqui coisas que o sistema sabe mesmo fazer. Um estado que
 * prometesse "menos consumo" sem tocar em nada seria uma etiqueta bonita e uma
 * mentira — por isso cada campo corresponde a um efeito verificável:
 * contagem de partículas, política de avisos e ritmo de sondagem.
 */
export interface SystemStateDefinition {
  readonly id: SystemStateId;
  readonly name: string;
  readonly description: string;
  readonly icon: LucideIcon;
  /** Multiplica a contagem de partículas do núcleo. */
  readonly particleScale: number;
  /** Que avisos chegam a aparecer no ecrã. Todos ficam no painel. */
  readonly toasts: 'todos' | 'urgentes' | 'nenhum';
  /** Ritmo da sondagem de métricas, em milissegundos. */
  readonly metricsIntervalMs: number;
}

export const SYSTEM_STATES: Readonly<Record<SystemStateId, SystemStateDefinition>> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'Tudo ligado, como foi desenhado.',
    icon: Sparkles,
    particleScale: 1,
    toasts: 'todos',
    metricsIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  },
  foco: {
    id: 'foco',
    name: 'Foco',
    description: 'Só o que for urgente interrompe. O resto espera no painel.',
    icon: Focus,
    particleScale: 0.6,
    toasts: 'urgentes',
    metricsIntervalMs: DEFAULT_POLL_INTERVAL_MS * 2,
  },
  apresentacao: {
    id: 'apresentacao',
    name: 'Apresentação',
    description: 'Nada aparece por cima do ecrã. Nem os erros.',
    icon: MonitorPlay,
    particleScale: 1,
    toasts: 'nenhum',
    metricsIntervalMs: DEFAULT_POLL_INTERVAL_MS * 3,
  },
  economia: {
    id: 'economia',
    name: 'Economia',
    description: 'Menos partículas, menos brilho e sondagem mais lenta.',
    icon: Battery,
    particleScale: 0.25,
    toasts: 'urgentes',
    metricsIntervalMs: DEFAULT_POLL_INTERVAL_MS * 5,
  },
  performance: {
    id: 'performance',
    name: 'Performance',
    description: 'Métricas ao segundo, para ver o sistema a reagir.',
    icon: Gauge,
    particleScale: 1,
    toasts: 'todos',
    metricsIntervalMs: 1_000,
  },
};

export const ALL_SYSTEM_STATES: readonly SystemStateDefinition[] = Object.values(SYSTEM_STATES);

/** Severidades que um estado com `toasts: 'urgentes'` deixa passar. */
const URGENT_KINDS = new Set(['warn', 'err']);

/**
 * Se um aviso desta severidade chega a aparecer no ecrã.
 *
 * Devolver `false` **não** o deita fora: a notificação entra na mesma no
 * histórico e no painel. O que muda é só se interrompe.
 */
export function allowsToast(definition: SystemStateDefinition, kind: string): boolean {
  if (definition.toasts === 'todos') return true;
  if (definition.toasts === 'nenhum') return false;
  return URGENT_KINDS.has(kind);
}
