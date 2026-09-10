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

/**
 * As sete etapas visuais da sequência (Parte 4 §Etapas).
 *
 * 1. faísca com ondas concêntricas
 * 2. a faísca transforma-se em anéis
 * 3. linha escrita carácter a carácter
 * 4. as 10 verificações do sistema
 * 5. cartões de métricas
 * 6. núcleo JARVIS grande, com radar e partículas
 * 7. identidade do sistema, com a IA a falar
 */
export type BootStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** O que a IA diz ao terminar o arranque (Parte 4 §8). */
export const BOOT_SPOKEN_LINE = 'Bom dia. Todos os sistemas foram inicializados com sucesso.';

/** Texto do arranque rápido (Parte 4 §Pular boot). */
export const BOOT_WELCOME_BACK = 'Bem-vindo de volta';

/** Ritmo da sequência, em milissegundos. */
export const BOOT_TIMING = {
  /** Faísca inicial, antes de os anéis se formarem. */
  sparkDuration: 1_500,
  /** Tempo em que os anéis giram sozinhos, antes do texto. */
  ringsDuration: 1_800,
  /** Tempo em que o núcleo grande fica em ecrã. */
  coreDuration: 2_600,
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

/**
 * Chave do `sessionStorage` para forçar uma verificação a falhar (Parte 4
 * §Modo de erro simulado).
 *
 * O valor é o índice da verificação (0 a 9), ou "todas" para as falhar
 * todas. Exemplo na consola do browser:
 *   sessionStorage.setItem('jarvis-debug.bootFailAt', '3');
 *
 * Fora do `sessionStorage`, o arranque corre sempre sem erro. É de propósito:
 * esta é uma ferramenta de desenvolvimento, não um caminho que um utilizador
 * normal encontre por acidente.
 */
export const BOOT_DEBUG_FAIL_KEY = 'jarvis-debug.bootFailAt';

/** Cartões de métricas da quarta etapa. */
export const BOOT_GRAPHS: readonly { readonly key: string; readonly value: string }[] = [
  { key: 'CPU', value: '24%' },
  { key: 'RAM', value: '5.8 GB' },
  { key: 'GPU', value: '12%' },
  { key: 'Rede', value: '88 Mb/s' },
  { key: 'Disco', value: '412 GB' },
];
