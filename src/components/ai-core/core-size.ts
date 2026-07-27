import { BREAKPOINTS } from '@/design-system/tokens';

/**
 * Diâmetro do núcleo por dispositivo (Parte 8 §Dimensões).
 *
 * Escalonamento proporcional em vez de um só tamanho com `max-width`: num
 * tablet, 420px espremidos a 78vmin dariam um núcleo desproporcionado face ao
 * resto da interface.
 */
export const CORE_SIZES = {
  desktop: 420,
  notebook: 360,
  tablet: 280,
  mobile: 220,
} as const;

/** Largura abaixo da qual se passa a considerar um portátil. */
const NOTEBOOK_MAX_WIDTH = 1_600;

export function pickCoreSize(viewportWidth: number): number {
  if (viewportWidth <= BREAKPOINTS.tight) return CORE_SIZES.mobile;
  if (viewportWidth <= BREAKPOINTS.compact) return CORE_SIZES.tablet;
  if (viewportWidth <= NOTEBOOK_MAX_WIDTH) return CORE_SIZES.notebook;
  return CORE_SIZES.desktop;
}
