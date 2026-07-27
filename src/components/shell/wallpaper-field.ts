import { BREAKPOINTS } from '@/design-system/tokens';

/**
 * Campo de partículas e linhas holográficas do wallpaper.
 *
 * Fora do componente de propósito: é matemática e desenho em canvas, sem nada de
 * React. O componente só lhe passa o contexto e o tamanho, e chama `draw` a cada
 * frame.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

interface Streak {
  horizontal: boolean;
  position: number;
  progress: number;
  speed: number;
  length: number;
}

/** Distância máxima a que duas partículas se ligam, em pixels lógicos. */
const LINK_DISTANCE = 118;
/** Quantas linhas holográficas atravessam o ecrã ao mesmo tempo. */
const STREAK_COUNT = 5;

export class WallpaperField {
  private particles: Particle[] = [];
  private streaks: Streak[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  /**
   * Redimensiona e repovoa o campo.
   *
   * A contagem de partículas acompanha a largura e é cortada em ecrãs pequenos —
   * é o que segura os 60 FPS no telemóvel.
   */
  resize(width: number, height: number, dpr: number, reducedMotion: boolean): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    const logicalWidth = width / dpr;
    const isSmallScreen = logicalWidth <= BREAKPOINTS.compact;

    const count = reducedMotion
      ? 0
      : Math.round(Math.min(isSmallScreen ? 34 : 80, logicalWidth / (isSmallScreen ? 26 : 20)));

    this.particles = Array.from({ length: count }, () => this.spawnParticle());
    this.streaks = reducedMotion
      ? []
      : Array.from({ length: isSmallScreen ? 3 : STREAK_COUNT }, () => this.spawnStreak());
  }

  private spawnParticle(): Particle {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.14 * this.dpr,
      vy: (Math.random() - 0.5) * 0.14 * this.dpr,
      radius: (Math.random() * 1.4 + 0.35) * this.dpr,
      alpha: 0.25 + Math.random() * 0.45,
    };
  }

  private spawnStreak(): Streak {
    const horizontal = Math.random() > 0.5;
    return {
      horizontal,
      position: Math.random() * (horizontal ? this.height : this.width),
      progress: -Math.random(),
      speed: 0.0016 + Math.random() * 0.0022,
      length: (160 + Math.random() * 260) * this.dpr,
    };
  }

  /** Desenha um frame. `accent` vem do tema em vigor. */
  draw(particleCtx: CanvasRenderingContext2D, lineCtx: CanvasRenderingContext2D, accent: RGB): void {
    this.drawParticles(particleCtx, accent);
    this.drawStreaks(lineCtx, accent);
  }

  private drawParticles(ctx: CanvasRenderingContext2D, accent: RGB): void {
    ctx.clearRect(0, 0, this.width, this.height);
    const link = LINK_DISTANCE * this.dpr;

    for (const particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Ressalta nas bordas em vez de reaparecer do outro lado — mantém a
      // densidade estável no centro do ecrã.
      if (particle.x < 0 || particle.x > this.width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > this.height) particle.vy *= -1;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = rgba(accent, particle.alpha);
      ctx.fill();
    }

    // Ligações entre partículas próximas. O par (i, j) é O(n²), daí o teto na
    // contagem de partículas.
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      if (!a) continue;

      for (let j = i + 1; j < this.particles.length; j++) {
        const b = this.particles[j];
        if (!b) continue;

        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance >= link) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(accent, 0.11 * (1 - distance / link));
        ctx.lineWidth = 0.55 * this.dpr;
        ctx.stroke();
      }
    }
  }

  private drawStreaks(ctx: CanvasRenderingContext2D, accent: RGB): void {
    ctx.clearRect(0, 0, this.width, this.height);

    for (const streak of this.streaks) {
      streak.progress += streak.speed;

      if (streak.progress > 1.3) {
        Object.assign(streak, this.spawnStreak());
        continue;
      }

      const travel = streak.progress * (streak.horizontal ? this.width : this.height);
      const gradient = streak.horizontal
        ? ctx.createLinearGradient(travel - streak.length, 0, travel, 0)
        : ctx.createLinearGradient(0, travel - streak.length, 0, travel);

      gradient.addColorStop(0, rgba(accent, 0));
      gradient.addColorStop(1, rgba(accent, 0.24));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.dpr;
      ctx.beginPath();

      if (streak.horizontal) {
        ctx.moveTo(travel - streak.length, streak.position);
        ctx.lineTo(travel, streak.position);
      } else {
        ctx.moveTo(streak.position, travel - streak.length);
        ctx.lineTo(streak.position, travel);
      }

      ctx.stroke();
    }
  }
}

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function rgba(color: RGB, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${color.r},${color.g},${color.b},${clamped.toFixed(3)})`;
}

/** Converte `#00CFFF` (ou `#0CF`) em componentes. Cai no ciano se falhar. */
export function parseHexColor(hex: string): RGB {
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
