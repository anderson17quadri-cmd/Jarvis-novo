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

/**
 * Família tipográfica (Parte 15 §Tipografia à escolha).
 *
 * Três, não uma lista longa. Cada uma lê-se diferente o suficiente para a
 * escolha significar alguma coisa — uma humanista, uma geométrica, uma
 * técnica — e todas vêm do repositório, nunca da rede: ver `styles/fonts.css`.
 */
export type FontFamilyKind = 'inter' | 'space-grotesk' | 'plex-sans';

export const FONT_FAMILY_LABELS: Record<FontFamilyKind, string> = {
  inter: 'Inter',
  'space-grotesk': 'Space Grotesk',
  'plex-sans': 'IBM Plex Sans',
};

export const FONT_FAMILY_DESCRIPTIONS: Record<FontFamilyKind, string> = {
  inter: 'Humanista, neutra. A predefinida.',
  'space-grotesk': 'Geométrica, com um ar técnico — assenta bem num sistema que se diz de IA.',
  'plex-sans': 'Desenhada para ecrãs de engenharia. Densa, muito legível em texto pequeno.',
};

/**
 * A pilha CSS de cada família, com a mesma cauda de recurso do token original
 * do Tailwind — um sistema sem a fonte escolhida ainda mostra algo decente.
 */
export const FONT_FAMILY_STACKS: Record<FontFamilyKind, string> = {
  inter: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
  'space-grotesk': "'Space Grotesk', 'SF Pro Display', system-ui, -apple-system, sans-serif",
  'plex-sans': "'IBM Plex Sans', 'SF Pro Display', system-ui, -apple-system, sans-serif",
};

/**
 * Daltonismo (Parte 15 §Acessibilidade).
 *
 * Os três tipos que valem a pena distinguir. Não se corrige "daltonismo" em
 * geral: quem não vê o vermelho precisa do contrário de quem não vê o azul.
 */
export type DaltonismKind = 'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export const DALTONISM_LABELS: Record<DaltonismKind, string> = {
  nenhum: 'Sem correção',
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
};

export const DALTONISM_DESCRIPTIONS: Record<DaltonismKind, string> = {
  nenhum: 'As cores do tema, como foram desenhadas.',
  protanopia: 'Dificuldade com o vermelho. Desloca-o para onde se vê.',
  deuteranopia: 'Dificuldade com o verde. A mais comum das três.',
  tritanopia: 'Dificuldade com o azul e o amarelo.',
};

/**
 * Matrizes de correção, em formato `feColorMatrix` — 20 números, 4 por linha.
 *
 * Compensação de Machado, Oliveira e Fernandes: em vez de simular o defeito,
 * empurra a informação que se perderia para os canais que a pessoa distingue.
 * `nenhum` é a identidade, e existe só para a tabela ser exaustiva.
 */
export const DALTONISM_MATRICES: Record<DaltonismKind, readonly number[]> = {
  nenhum: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  protanopia: [
    0.567, 0.433, 0, 0, 0,
    0.558, 0.442, 0, 0, 0,
    0, 0.242, 0.758, 0, 0,
    0, 0, 0, 1, 0,
  ],
  deuteranopia: [
    0.625, 0.375, 0, 0, 0,
    0.7, 0.3, 0, 0, 0,
    0, 0.3, 0.7, 0, 0,
    0, 0, 0, 1, 0,
  ],
  tritanopia: [
    0.95, 0.05, 0, 0, 0,
    0, 0.433, 0.567, 0, 0,
    0, 0.475, 0.525, 0, 0,
    0, 0, 0, 1, 0,
  ],
};

export interface Appearance {
  readonly wallpaper: WallpaperKind;
  /** Entre 0 e 1. Multiplica a opacidade das camadas do papel de parede. */
  readonly wallpaperIntensity: number;
  /** Entre 0.25 e 1.5. Multiplica a contagem de partículas do núcleo. */
  readonly coreParticles: number;
  /**
   * Cor do núcleo, à parte do acento do tema. `null` é o comportamento de
   * sempre — o acento do tema. Só se aplica em repouso: os modos com cor
   * própria (analisar, responder, falha) continuam a ignorar isto, pela
   * mesma razão por que já ignoram o tema — essa cor tem significado.
   */
  readonly coreColor: string | null;
  /** Entre 0.5 e 2. Multiplica a velocidade de rotação dos anéis do núcleo. */
  readonly coreSpeed: number;
  /** Entre 0.9 e 1.3. Escala global do texto e dos espaços. */
  readonly uiScale: number;
  readonly radius: RadiusKind;
  readonly cursor: CursorKind;
  readonly fontFamily: FontFamilyKind;
  /** Sobe o contraste do texto e das linhas. */
  readonly highContrast: boolean;
  /** Tira o desfoque das superfícies. Ajuda a ler, e alivia máquinas lentas. */
  readonly reduceTransparency: boolean;
  readonly daltonism: DaltonismKind;
  /**
   * Minutos de inatividade até voltar ao bloqueio (Parte 14).
   * `0` desliga — e a interface diz o que isso significa.
   */
  readonly idleLockMinutes: number;
}

export const DEFAULT_APPEARANCE: Appearance = {
  wallpaper: 'nebulosa',
  wallpaperIntensity: 1,
  coreParticles: 1,
  coreColor: null,
  coreSpeed: 1,
  uiScale: 1,
  radius: 'redondo',
  cursor: 'holografico',
  fontFamily: 'inter',
  highContrast: false,
  reduceTransparency: false,
  daltonism: 'nenhum',
  // Quinze minutos por omissão: curto o suficiente para servir de alguma
  // coisa, longo o suficiente para não interromper quem está a ler.
  idleLockMinutes: 15,
};

/**
 * O que viaja num perfil, e o que nunca viaja (Parte 15 §Perfis).
 *
 * Um perfil leva o **ambiente**: papel de parede e a sua intensidade,
 * partículas do núcleo, cursor, arredondamento e família tipográfica. Não leva
 * a **acessibilidade** — contraste alto, transparência reduzida, correção de
 * daltonismo, escala da interface e bloqueio por inatividade ficam onde estão.
 *
 * A razão não é técnica. Quem precisa de correção de daltonismo precisa dela
 * em todos os perfis; um perfil "Jogos" que a desligasse ao ser aplicado era o
 * sistema a tirar à pessoa aquilo de que ela depende para o ver. O mesmo vale
 * para o bloqueio por inatividade, que é uma decisão de segurança e não de
 * decoração.
 */
export const AMBIENCE_KEYS = [
  'wallpaper',
  'wallpaperIntensity',
  'coreParticles',
  'coreColor',
  'coreSpeed',
  'cursor',
  'radius',
  'fontFamily',
] as const;

export type AmbienceKey = (typeof AMBIENCE_KEYS)[number];

export type Ambience = Pick<Appearance, AmbienceKey>;

/**
 * Tira o ambiente de uma aparência completa.
 *
 * Escrito campo a campo de propósito: `Pick` obriga a que estejam cá todos, e
 * por isso acrescentar uma chave a `AMBIENCE_KEYS` sem a copiar aqui não
 * compila. Um ciclo sobre as chaves precisava de uma conversão de tipo, e essa
 * calava exatamente o erro que se quer ver.
 */
export function ambienceOf(appearance: Appearance): Ambience {
  return {
    wallpaper: appearance.wallpaper,
    wallpaperIntensity: appearance.wallpaperIntensity,
    coreParticles: appearance.coreParticles,
    coreColor: appearance.coreColor,
    coreSpeed: appearance.coreSpeed,
    cursor: appearance.cursor,
    radius: appearance.radius,
    fontFamily: appearance.fontFamily,
  };
}

export const DEFAULT_AMBIENCE: Ambience = ambienceOf(DEFAULT_APPEARANCE);

/** Limites de cada valor contínuo, para a interface e para o store. */
export const APPEARANCE_RANGES = {
  wallpaperIntensity: { min: 0, max: 1, step: 0.05 },
  coreParticles: { min: 0.25, max: 1.5, step: 0.05 },
  coreSpeed: { min: 0.5, max: 2, step: 0.05 },
  uiScale: { min: 0.9, max: 1.3, step: 0.05 },
} as const;

/** Opções de bloqueio, em minutos. `0` é "nunca". */
export const IDLE_LOCK_OPTIONS: readonly number[] = [0, 1, 5, 15, 30, 60];

export function idleLockLabel(minutes: number): string {
  if (minutes === 0) return 'Nunca';
  if (minutes === 1) return '1 minuto';
  if (minutes < 60) return `${minutes} minutos`;
  return '1 hora';
}

/** Traz um número para dentro dos limites. */
export function clampAppearance<K extends keyof typeof APPEARANCE_RANGES>(
  key: K,
  value: number,
): number {
  const range = APPEARANCE_RANGES[key];
  if (!Number.isFinite(value)) return DEFAULT_APPEARANCE[key];
  return Math.min(range.max, Math.max(range.min, value));
}
