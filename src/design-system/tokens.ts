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
  /*
   * Canais RGB, sem opacidade, para o Tailwind lhes poder aplicar a sua.
   *
   * `tintRgb` é a cor que se sobrepõe ao fundo para levantar uma superfície:
   * branco nos temas escuros, preto nos claros. `glassRgb` e `glassDeepRgb`
   * são as superfícies opacas — cartões, janelas, dock, painéis.
   *
   * Escritos como "16 25 34" e não como `#101922` porque é a única forma de
   * `bg-glass/[.74]` funcionar: o Tailwind injeta a opacidade no meio.
   */
  tintRgb: '255 255 255',
  glassRgb: '16 25 34',
  glassDeepRgb: '11 17 24',
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

/** Os que vêm com o sistema. */
export type OfficialThemeId =
  | 'classic'
  | 'oled'
  | 'titanium'
  | 'emerald'
  | 'solar'
  | 'midnight'
  | 'cyber-red'
  | 'graphite'
  | 'aurora'
  | 'arctic';

/**
 * Um tema, oficial ou feito pelo utilizador.
 *
 * Os personalizados levam `custom:` à frente — assim nunca colidem com um
 * oficial, e quem lê um identificador sabe de imediato de onde ele vem.
 */
export type ThemeId = OfficialThemeId | `custom:${string}`;

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
  readonly line?: string;
  readonly line2?: string;
  readonly t1?: string;
  readonly t2?: string;
  readonly t3?: string;
  readonly tintRgb?: string;
  readonly glassRgb?: string;
  readonly glassDeepRgb?: string;
}

export interface ThemeDefinition {
  readonly id: OfficialThemeId;
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
    /*
     * O vidro também escurece.
     *
     * Antes só o `--card` mudava, mas os cartões, janelas e dock estavam com a
     * cor do Classic escrita à mão — num fundo preto ficavam cinzento-azulados,
     * e o tema OLED só era OLED no papel de parede.
     */
    overrides: {
      bg: '#000000',
      bg2: '#050505',
      card: '#0B0B0B',
      cardHover: '#141414',
      glassRgb: '11 11 11',
      glassDeepRgb: '5 5 5',
    },
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
  {
    id: 'midnight',
    name: 'Midnight Blue',
    swatches: ['#070C18', '#4C7DFF', '#2E5BD9'],
    overrides: {
      bg: '#070C18',
      bg2: '#0C1426',
      card: '#111C33',
      cardHover: '#182645',
      accent: '#4C7DFF',
      neon: '#2E5BD9',
      glow: '0 0 24px rgba(76,125,255,.26)',
      glassRgb: '17 28 51',
      glassDeepRgb: '12 20 38',
    },
  },
  {
    id: 'cyber-red',
    name: 'Cyber Red',
    swatches: ['#0A0406', '#FF3B5C', '#D91F42'],
    overrides: {
      bg: '#0A0406',
      bg2: '#140A0E',
      card: '#1B0E13',
      cardHover: '#28151C',
      accent: '#FF3B5C',
      neon: '#D91F42',
      glow: '0 0 24px rgba(255,59,92,.26)',
      glassRgb: '27 14 19',
      glassDeepRgb: '20 10 14',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    swatches: ['#0D0D0F', '#9AA3AD', '#6F7883'],
    overrides: {
      bg: '#0D0D0F',
      bg2: '#141417',
      card: '#1B1B1F',
      cardHover: '#26262B',
      accent: '#9AA3AD',
      neon: '#6F7883',
      glow: '0 0 20px rgba(154,163,173,.18)',
      glassRgb: '27 27 31',
      glassDeepRgb: '20 20 23',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    swatches: ['#060B12', '#5CF2C4', '#7B6BFF'],
    overrides: {
      bg: '#060B12',
      bg2: '#0B141F',
      card: '#0F1C2B',
      cardHover: '#16283D',
      accent: '#5CF2C4',
      neon: '#7B6BFF',
      glow: '0 0 26px rgba(92,242,196,.24)',
      glassRgb: '15 28 43',
      glassDeepRgb: '11 20 31',
    },
  },
  {
    /*
     * O único tema claro.
     *
     * Obriga a virar tudo o que estava assente em "branco sobre escuro": o
     * texto, as linhas e — sobretudo — a `tintRgb`, que passa a preto. Sem
     * isso, as superfícies levantadas seriam branco sobre branco, invisíveis.
     */
    id: 'arctic',
    name: 'Arctic White',
    swatches: ['#F4F7FA', '#0088CC', '#0066AA'],
    overrides: {
      bg: '#F4F7FA',
      bg2: '#E9EEF4',
      card: '#FFFFFF',
      cardHover: '#F0F4F8',
      line: 'rgba(10,20,30,.10)',
      line2: 'rgba(10,20,30,.18)',
      t1: '#0B1622',
      t2: '#33465C',
      t3: '#6B7C91',
      accent: '#0088CC',
      neon: '#0066AA',
      glow: '0 0 22px rgba(0,136,204,.18)',
      tintRgb: '10 20 30',
      glassRgb: '255 255 255',
      glassDeepRgb: '244 247 250',
    },
  },
] as const;

export const DEFAULT_THEME: ThemeId = 'classic';
