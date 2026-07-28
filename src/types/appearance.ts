/**
 * Aparência do sistema (Parte 15 §Centro de Personalização).
 *
 * Tudo o que se pode mudar sem trocar de tema: papel de parede, núcleo,
 * densidade da interface, cursor e acessibilidade.
 *
 * Só entram opções que produzem um efeito verificável. Uma preferência que
 * não mude nada é pior do que uma preferência que não existe — dá a impressão
 * de que o sistema a ignorou.
 */

export type WallpaperKind = 'nebulosa' | 'grelha' | 'particulas' | 'liso';

export const WALLPAPER_LABELS: Record<WallpaperKind, string> = {
  nebulosa: 'Nebulosa',
  grelha: 'Grelha',
  particulas: 'Partículas',
  liso: 'Liso',
};

export const WALLPAPER_DESCRIPTIONS: Record<WallpaperKind, string> = {
  nebulosa: 'Todas as camadas: nebulosa, grelha, partículas e linhas.',
  grelha: 'Só a grelha técnica, com parallax.',
  particulas: 'Só as partículas ligadas e as linhas holográficas.',
  liso: 'Nada. O fundo do tema, e mais nada.',
};

export type CursorKind = 'holografico' | 'minimal' | 'sistema';

export const CURSOR_LABELS: Record<CursorKind, string> = {
  holografico: 'Holográfico',
  minimal: 'Minimal',
  sistema: 'Do sistema',
};

/** Arredondamento das superfícies. */
export type RadiusKind = 'redondo' | 'suave' | 'reto';

export const RADIUS_LABELS: Record<RadiusKind, string> = {
  redondo: 'Redondo',
  suave: 'Suave',
  reto: 'Reto',
};

/** Multiplicadores aplicados aos raios dos tokens. */
export const RADIUS_SCALE: Record<RadiusKind, number> = {
  redondo: 1,
  suave: 0.6,
  reto: 0.15,
};

export interface Appearance {
  readonly wallpaper: WallpaperKind;
  /** Entre 0 e 1. Multiplica a opacidade das camadas do papel de parede. */
  readonly wallpaperIntensity: number;
  /** Entre 0.25 e 1.5. Multiplica a contagem de partículas do núcleo. */
  readonly coreParticles: number;
  /** Entre 0.9 e 1.3. Escala global do texto e dos espaços. */
  readonly uiScale: number;
  readonly radius: RadiusKind;
  readonly cursor: CursorKind;
  /** Sobe o contraste do texto e das linhas. */
  readonly highContrast: boolean;
  /** Tira o desfoque das superfícies. Ajuda a ler, e alivia máquinas lentas. */
  readonly reduceTransparency: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  wallpaper: 'nebulosa',
  wallpaperIntensity: 1,
  coreParticles: 1,
  uiScale: 1,
  radius: 'redondo',
  cursor: 'holografico',
  highContrast: false,
  reduceTransparency: false,
};

/** Limites de cada valor contínuo, para a interface e para o store. */
export const APPEARANCE_RANGES = {
  wallpaperIntensity: { min: 0, max: 1, step: 0.05 },
  coreParticles: { min: 0.25, max: 1.5, step: 0.05 },
  uiScale: { min: 0.9, max: 1.3, step: 0.05 },
} as const;

/** Traz um número para dentro dos limites. */
export function clampAppearance<K extends keyof typeof APPEARANCE_RANGES>(
  key: K,
  value: number,
): number {
  const range = APPEARANCE_RANGES[key];
  if (!Number.isFinite(value)) return DEFAULT_APPEARANCE[key];
  return Math.min(range.max, Math.max(range.min, value));
}
