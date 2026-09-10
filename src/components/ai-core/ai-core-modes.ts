import type { AssistantMode } from '@/types/assistant';

/**
 * Como o núcleo se comporta em cada estado.
 *
 * Valores extraídos do protótipo. A cor de cada modo é fixa de propósito — o
 * amarelo de "a analisar" e o vermelho de "falha" têm de se ler à mesma em
 * qualquer tema, senão o tema Solar tornava o erro indistinguível do normal.
 * Só o `idle` e o `listening` seguem o acento do tema.
 */
export interface CoreModeConfig {
  readonly label: string;
  /** `null` significa "usa o acento do tema em vigor". */
  readonly color: string | null;
  /** Multiplicador da rotação dos anéis e da velocidade orbital. */
  readonly spin: number;
  /** Multiplicador da opacidade das partículas. */
  readonly density: number;
  /** Velocidade do radar. Zero pára-o. */
  readonly sweepSpeed: number;
  /** Para onde as partículas derivam: negativo puxa para dentro. */
  readonly drift: number;
  /** Amplitude da pulsação do núcleo central. */
  readonly glowPulse: number;
  /** Camada 6 — linhas horizontais a varrer o núcleo. */
  readonly scanner: boolean;
}

export const CORE_MODES: Record<AssistantMode, CoreModeConfig> = {
  idle: {
    label: 'Em espera',
    color: null,
    spin: 1,
    density: 0.55,
    sweepSpeed: 1,
    drift: 0.2,
    glowPulse: 0.03,
    scanner: false,
  },
  listening: {
    label: 'A ouvir',
    color: null,
    spin: 2.2,
    density: 1,
    sweepSpeed: 1.6,
    // As partículas colapsam para o centro — o núcleo está a absorver.
    drift: -1.6,
    glowPulse: 0.09,
    scanner: false,
  },
  thinking: {
    label: 'A analisar',
    color: '#FBBF24',
    spin: 3.2,
    density: 1.2,
    // Radar ao dobro da velocidade de repouso (Parte 8 §Processando).
    sweepSpeed: 2.4,
    drift: 0.2,
    glowPulse: 0.09,
    // O scanner só corre a analisar — é o que distingue "a pensar" de "ativo".
    scanner: true,
  },
  speaking: {
    label: 'A responder',
    color: '#22C55E',
    spin: 1.8,
    density: 1.1,
    sweepSpeed: 1.3,
    // E aqui expandem — está a emitir.
    drift: 1.1,
    glowPulse: 0.09,
    scanner: false,
  },
  error: {
    label: 'Falha',
    color: '#EF4444',
    spin: 0.4,
    density: 0.4,
    // Radar parado: o sistema não está a varrer nada.
    sweepSpeed: 0,
    drift: 0.2,
    glowPulse: 0.09,
    scanner: false,
  },
  success: {
    label: 'Concluído',
    color: '#22C55E',
    spin: 1.2,
    density: 1.3,
    sweepSpeed: 1,
    // Explosão para fora, forte e breve.
    drift: 2.4,
    glowPulse: 0.14,
    scanner: false,
  },
};
