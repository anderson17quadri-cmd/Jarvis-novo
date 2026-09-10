import { themeService } from './theme-service';
import { WallpaperField } from '@/components/shell/wallpaper-field';
import type { RGB } from '@/components/shell/wallpaper-field';

/**
 * Papel de parede procedural.
 *
 * O `WallpaperField` já era uma classe pura (só matemática e canvas, zero
 * React). Este serviço é a casca que o envolve com as dependências de que
 * ele precisa: a cor de acento do tema e as dimensões da janela.
 *
 * O componente `Wallpaper` só lê da store e chama `draw` — nunca fala com
 * o `themeService` nem cria o campo sozinho.
 */
export class WallpaperService {
  readonly field = new WallpaperField();

  /** Lê a cor de acento do tema em vigor — o canvas não resolve `var(--accent)`. */
  readAccentColor(): RGB {
    return parseHexColor(themeService.readAccentColor());
  }

  /** Redimensiona o campo para as dimensões da janela. */
  resize(width: number, height: number, dpr: number, reducedMotion: boolean): void {
    this.field.resize(width, height, dpr, reducedMotion);
  }

  /** Desenha um frame. `accent` vem do tema em vigor. */
  draw(
    particleCtx: CanvasRenderingContext2D,
    lineCtx: CanvasRenderingContext2D,
    accent: RGB,
  ): void {
    this.field.draw(particleCtx, lineCtx, accent);
  }
}

/** Converte `#00CFFF` (ou `#0CF`) em componentes. Cai no ciano se falhar. */
function parseHexColor(hex: string): RGB {
  const clean = hex.trim().replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;

  const value = Number.parseInt(expanded.slice(0, 6), 16);
  if (Number.isNaN(value)) return { r: 0, g: 207, b: 255 };

  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export const wallpaperService = new WallpaperService();
