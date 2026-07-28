/**
 * Design System — tokens.
 *
 * Fonte única de verdade. Extraídos do protótipo `docs/spec/design-reference/jarvis-ai-os.html`
 * (bloco `:root`). O `tailwind.config.ts` importa daqui, e o `themes.css` gera as
 * variáveis CSS a partir dos mesmos valores.
 *
 * Regra: nenhum valor de cor, raio, espaçamento, duração ou curva pode ser escrito
 * à mão noutro ficheiro. Se falta um token, acrescenta-se aqui.
 */

/** Superfícies, texto e acentos do tema base (JARVIS Classic). */
export const COLORS = {
  bg: '#05070A',
  bg2: '#0B1118',
  card: '#101922',
  cardHover: '#162434',
  line: 'rgba(255,255,255,.06)',
  line2: 'rgba(255,255,255,.12)',
  t1: '#FFFFFF',
  t2: '#C5D1DF',
  t3: '#7E91A8',
  accent: '#00CFFF',
  neon: '#00A2FF',
  green: '#22C55E',
  yellow: '#FBBF24',
  red: '#EF4444',
} as const;

/** Raios por tipo de superfície. */
export const RADIUS = {
  btn: '16px',
  card: '20px',
  modal: '24px',
  input: '14px',
} as const;

/** Escala de espaçamento (s1..s6 no protótipo). */
export const SPACING = {
  s1: '8px',
  s2: '16px',
  s3: '24px',
  s4: '32px',
  s5: '48px',
  s6: '64px',
} as const;

/** Medidas estruturais do shell. */
export const LAYOUT = {
  headerHeight: '72px',
  railWidth: '88px',
  railWidthOpen: '280px',
} as const;

/** Curvas de animação. */
export const EASING = {
  /** Saída suave — entradas, hovers, tudo o que "aterra". */
  out: 'cubic-bezier(.16,1,.3,1)',
  /** Entrada e saída — transições de ecrã e painéis. */
  inOut: 'cubic-bezier(.65,0,.35,1)',
} as const;

/**
 * Durações, em milissegundos (Parte 9 §Durações).
 * Exportadas como número para o Framer Motion.
 */
export const DURATION_MS = {
  hover: 120,
  click: 150,
  panel: 220,
  window: 280,
  /** Troca de tema — mais rápida do que a transição entre ecrãs. */
  theme: 500,
  screen: 600,
} as const;

/** As mesmas durações em CSS, para o tema do Tailwind. */
export const DURATION = {
  hover: '120ms',
  click: '150ms',
  panel: '220ms',
  window: '280ms',
  theme: '500ms',
  screen: '600ms',
} as const;

/** Sombras e brilho. */
export const SHADOW = {
  sh1: '0 8px 32px rgba(0,0,0,.4)',
  sh2: '0 20px 60px rgba(0,0,0,.55)',
  glow: '0 0 24px rgba(0,207,255,.25)',
} as const;

/**
 * Pontos de quebra. Alinhados com o protótipo:
 * 1100px estreita o rail, 820px passa para o modo compacto (gaveta + janelas
 * empilhadas), 520px é o telemóvel apertado.
 */
export const BREAKPOINTS = {
  rail: 1100,
  compact: 820,
  tight: 520,
} as const;

/** Alvo mínimo de toque exigido em `pointer: coarse`. */
export const TOUCH_TARGET_MIN_PX = 44;

export type ThemeId = 'classic' | 'oled' | 'titanium' | 'emerald' | 'solar';

/**
 * Um tema só pode redefinir um subconjunto de tokens — as sobreposições que o
 * protótipo aplica em `[data-theme="…"]`. Tudo o resto herda do Classic.
 */
export interface ThemeOverrides {
  readonly bg?: string;
  readonly bg2?: string;
  readonly card?: string;
  readonly cardHover?: string;
  readonly accent?: string;
  readonly neon?: string;
  readonly glow?: string;
}

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  /** As três amostras mostradas no seletor de temas. */
  readonly swatches: readonly [string, string, string];
  readonly overrides: ThemeOverrides;
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'classic',
    name: 'JARVIS Classic',
    swatches: ['#05070A', '#00CFFF', '#00A2FF'],
    overrides: {},
  },
  {
    id: 'oled',
    name: 'OLED Black',
    swatches: ['#000000', '#00CFFF', '#0A0A0A'],
    overrides: { bg: '#000000', bg2: '#050505', card: '#0B0B0B', cardHover: '#141414' },
  },
  {
    id: 'titanium',
    name: 'Titanium',
    swatches: ['#05070A', '#B8C4CE', '#8E9BA8'],
    overrides: { accent: '#B8C4CE', neon: '#8E9BA8', glow: '0 0 24px rgba(184,196,206,.22)' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    swatches: ['#05070A', '#22E5A0', '#12B981'],
    overrides: { accent: '#22E5A0', neon: '#12B981', glow: '0 0 24px rgba(34,229,160,.25)' },
  },
  {
    id: 'solar',
    name: 'Solar',
    swatches: ['#05070A', '#FFB020', '#F59E0B'],
    overrides: { accent: '#FFB020', neon: '#F59E0B', glow: '0 0 24px rgba(255,176,32,.25)' },
  },
] as const;

export const DEFAULT_THEME: ThemeId = 'classic';
