import type { ThemeOverrides } from '@/design-system/tokens';

/**
 * Temas personalizados (Parte 15 §Editor de temas).
 *
 * Um tema oficial é uma tabela de quinze tokens escrita à mão. Pedir isso a
 * quem só quer "o meu azul" seria um formulário de quinze campos que ninguém
 * preenche — e onde é fácil escolher uma combinação ilegível.
 *
 * Por isso o editor pede **três coisas**: a cor de acento, a cor de fundo, e se
 * a base é clara ou escura. Os outros doze tokens derivam daí, com as mesmas
 * relações que os temas oficiais já usam. É menos liberdade, e é de propósito:
 * garante que o resultado se lê.
 */

export interface CustomTheme {
  /** `custom:` à frente, para nunca colidir com um tema oficial. */
  readonly id: `custom:${string}`;
  readonly name: string;
  readonly accent: string;
  readonly background: string;
  readonly isLight: boolean;
  readonly createdAt: number;
}

/** Quantos temas o utilizador pode guardar. */
export const CUSTOM_THEME_LIMIT = 12;

export function isCustomThemeId(value: string): value is `custom:${string}` {
  return value.startsWith('custom:');
}

// ── Cor ─────────────────────────────────────────────────────────────────────

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Lê `#rgb` ou `#rrggbb`. Devolve `null` ao que não for nenhum dos dois. */
export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0]! + hex[0], 16),
      g: Number.parseInt(hex[1]! + hex[1], 16),
      b: Number.parseInt(hex[2]! + hex[2], 16),
    };
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number): string =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

/** Mistura duas cores. `amount` 0 devolve a primeira, 1 devolve a segunda. */
function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * Luminância relativa, pela fórmula da WCAG.
 *
 * Serve para decidir se uma cor de fundo é clara ou escura sem ter de
 * perguntar — e para o contraste do texto ser calculado, não adivinhado.
 */
export function luminance(colour: Rgb): number {
  const channel = (value: number): number => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/** Razão de contraste entre duas cores, de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const first = parseHex(a);
  const second = parseHex(b);
  if (!first || !second) return 1;

  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));

  return (light + 0.05) / (dark + 0.05);
}

/** `true` quando a cor de fundo pede texto escuro. */
export function isLightColour(value: string): boolean {
  const colour = parseHex(value);
  return colour !== null && luminance(colour) > 0.4;
}

// ── Derivação ───────────────────────────────────────────────────────────────

/**
 * Os quinze tokens, a partir das três escolhas.
 *
 * As proporções são as dos temas oficiais: o segundo fundo levanta-se um pouco
 * do primeiro, o cartão um pouco mais, e o texto secundário afasta-se do
 * principal em passos iguais.
 */
export function deriveOverrides(theme: {
  readonly accent: string;
  readonly background: string;
  readonly isLight: boolean;
}): ThemeOverrides {
  const background = parseHex(theme.background) ?? BLACK;
  const accent = parseHex(theme.accent) ?? { r: 0, g: 207, b: 255 };

  // Nos temas escuros as superfícies levantam-se para o branco; nos claros
  // afundam-se para o preto. É a mesma inversão do `tintRgb`.
  const lift = theme.isLight ? BLACK : WHITE;
  const text = theme.isLight ? BLACK : WHITE;
  const away = theme.isLight ? WHITE : BLACK;

  return {
    bg: toHex(background),
    bg2: toHex(mix(background, lift, 0.05)),
    card: toHex(mix(background, lift, 0.09)),
    cardHover: toHex(mix(background, lift, 0.15)),
    accent: toHex(accent),
    // O neon é o acento um pouco mais fundo — é assim que o Classic o define.
    neon: toHex(mix(accent, BLACK, 0.2)),
    glow: `0 0 22px rgba(${Math.round(accent.r)},${Math.round(accent.g)},${Math.round(accent.b)},.28)`,
    line: `rgba(${theme.isLight ? '0,0,0' : '255,255,255'},.06)`,
    line2: `rgba(${theme.isLight ? '0,0,0' : '255,255,255'},.12)`,
    t1: toHex(text),
    t2: toHex(mix(text, away, 0.25)),
    t3: toHex(mix(text, away, 0.5)),
    tintRgb: theme.isLight ? '10 20 30' : '255 255 255',
    glassRgb: `${Math.round(mix(background, lift, 0.09).r)} ${Math.round(mix(background, lift, 0.09).g)} ${Math.round(mix(background, lift, 0.09).b)}`,
    glassDeepRgb: `${Math.round(mix(background, lift, 0.04).r)} ${Math.round(mix(background, lift, 0.04).g)} ${Math.round(mix(background, lift, 0.04).b)}`,
  };
}

/**
 * As três amostras do seletor, para um tema personalizado se apresentar como
 * os oficiais.
 */
export function customSwatches(theme: CustomTheme): readonly [string, string, string] {
  const overrides = deriveOverrides(theme);
  return [overrides.bg ?? '#000000', overrides.accent ?? '#00CFFF', overrides.card ?? '#101922'];
}

/**
 * Avisa quando o resultado não se lê.
 *
 * Não impede — quem quer um tema de baixo contraste tem direito a ele. Mas
 * deixar escolher branco sobre branco sem dizer nada seria deixar avariar em
 * silêncio.
 */
export function readabilityWarning(theme: {
  readonly accent: string;
  readonly background: string;
  readonly isLight: boolean;
}): string | null {
  const overrides = deriveOverrides(theme);
  const textRatio = contrastRatio(overrides.t1 ?? '#FFFFFF', overrides.bg ?? '#000000');
  const accentRatio = contrastRatio(overrides.accent ?? '#00CFFF', overrides.bg ?? '#000000');

  if (textRatio < 4.5) {
    return theme.isLight
      ? 'O texto escuro não contrasta com este fundo. Experimente a base escura.'
      : 'O texto claro não contrasta com este fundo. Experimente a base clara.';
  }

  if (accentRatio < 3) {
    return 'O acento quase não se distingue do fundo. Escolha uma cor mais afastada.';
  }

  return null;
}
