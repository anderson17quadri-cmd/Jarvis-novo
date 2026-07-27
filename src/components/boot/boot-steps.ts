import {
  Bot,
  Cloud,
  Cpu,
  LayoutDashboard,
  LayoutGrid,
  Mic,
  Monitor,
  Calendar,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** As 10 verificações da sequência de arranque. */
export interface BootStep {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

export const BOOT_STEPS: readonly BootStep[] = [
  { id: 'memory', label: 'A verificar memória', icon: Cpu },
  { id: 'neural', label: 'A iniciar motor neural', icon: Bot },
  { id: 'voice', label: 'A carregar motor de voz', icon: Mic },
  { id: 'graphics', label: 'A carregar motor gráfico', icon: Monitor },
  { id: 'security', label: 'A inicializar segurança', icon: Shield },
  { id: 'modules', label: 'A carregar módulos', icon: Zap },
  { id: 'interface', label: 'A preparar interface', icon: LayoutGrid },
  { id: 'clock', label: 'A sincronizar relógio', icon: Calendar },
  { id: 'plugins', label: 'A carregar plugins', icon: Cloud },
  { id: 'desktop', label: 'A preparar ambiente de trabalho', icon: LayoutDashboard },
];

/** As cinco etapas visuais por que a sequência passa. */
export type BootStage = 1 | 2 | 3 | 4 | 5;

/** Ritmo da sequência, em milissegundos. */
export const BOOT_TIMING = {
  /** Faísca inicial, antes de aparecer texto. */
  sparkDuration: 1_500,
  /** Velocidade base do typewriter, por carácter. */
  typeSpeed: 26,
  /** Pausa depois de a linha acabar de ser escrita. */
  typePause: 420,
  /** Intervalo entre o aparecimento de duas verificações. */
  stepStagger: 190,
  /** Tempo que cada verificação demora a ficar concluída. */
  stepDuration: 330,
  /** Tempo em que os gráficos ficam em ecrã. */
  graphsDuration: 1_500,
  /** Tempo em que a identidade fica em ecrã antes de sair. */
  identityDuration: 1_900,
  /** Duração do fade-out mais o scanline. */
  exitDuration: 850,
  /** Arranque rápido, quando já houve um arranque completo antes. */
  fastBootDuration: 1_500,
} as const;

export const BOOT_TYPE_LINE = 'Initializing Artificial Intelligence Core...';

/** Cartões de métricas da quarta etapa. */
export const BOOT_GRAPHS: readonly { readonly key: string; readonly value: string }[] = [
  { key: 'CPU', value: '24%' },
  { key: 'RAM', value: '5.8 GB' },
  { key: 'GPU', value: '12%' },
  { key: 'Rede', value: '88 Mb/s' },
  { key: 'Disco', value: '412 GB' },
];
