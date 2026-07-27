import { rgba, type RGB } from '@/components/shell/wallpaper-field';
import type { CoreModeConfig } from './ai-core-modes';

/**
 * Campo orbital do AI Core.
 *
 * Partículas em órbita, um radar que as ilumina ao passar, ligações temporárias
 * entre vizinhas e ondas de clique a partir do centro. Tudo desenhado em canvas,
 * sem tocar no DOM.
 *
 * Fora do componente porque é matemática: assim testa-se sem montar React e o
 * componente fica só com a ligação ao ciclo de vida.
 */

interface OrbitalParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  life: number;
  decay: number;
  drift: number;
  /** Variação de brilho entre partículas, para o campo não parecer uniforme. */
  shade: number;
  x: number;
  y: number;
}

interface Ripple {
  radius: number;
  alpha: number;
}

/** Contagem de partículas por contexto. */
export const PARTICLE_COUNTS = {
  full: 300,
  /** Ecrãs pequenos: menos de metade, para segurar os 60 FPS no telemóvel. */
  small: 120,
  reduced: 60,
} as const;

/** Uma volta completa do radar, em milissegundos, no modo `idle`. */
const SWEEP_PERIOD_MS = 4_000;
/** Abertura do cone do radar, em radianos. */
const SWEEP_ARC = 0.42;
/** Quão perto o radar tem de passar para acender uma partícula. */
const SWEEP_LIT_THRESHOLD = 0.3;

/** Fração da altura que o scanner percorre por frame, a 60 FPS. */
const SCANNER_SPEED = 0.006;
/** Deslocamento vertical e opacidade de cada linha do scanner. */
const SCANNER_LINES: readonly (readonly [number, number])[] = [
  [0, 0.32],
  [4, 0.16],
  [9, 0.07],
];

export class ParticleField {
  private particles: OrbitalParticle[] = [];
  private ripples: Ripple[] = [];
  private sweep = 0;
  /** Posição do scanner, de 0 (topo) a 1 (fundo). */
  private scannerY = 0;
  private width = 0;
  private height = 0;
  private centerX = 0;
  private centerY = 0;
  private radius = 0;
  private dpr = 1;

  resize(width: number, height: number, dpr: number, count: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.radius = Math.min(width, height) / 2;
    this.particles = Array.from({ length: count }, () => this.spawn());
  }

  private spawn(): OrbitalParticle {
    return {
      angle: Math.random() * Math.PI * 2,
      // Entre 16% e 98% do raio — deixa o núcleo central desimpedido.
      radius: this.radius * (0.16 + Math.random() * 0.82),
      speed: (0.0007 + Math.random() * 0.0032) * (Math.random() > 0.5 ? 1 : -1),
      size: (Math.random() * 1.5 + 0.35) * this.dpr,
      life: 1,
      decay: 0.0009 + Math.random() * 0.0022,
      drift: (Math.random() - 0.5) * 0.16 * this.dpr,
      shade: Math.random(),
      x: 0,
      y: 0,
    };
  }

  /** Uma onda a partir do centro, disparada ao clicar no núcleo. */
  addRipple(): void {
    this.ripples.push({ radius: this.radius * 0.16, alpha: 0.55 });
  }

  /**
   * Explosão de partículas do estado de sucesso (Parte 8 §Sucesso).
   *
   * Não cria partículas novas — reposiciona as existentes junto ao centro, com
   * deriva forte para fora. Assim a contagem mantém-se estável e o custo por
   * frame não sobe no momento em que se quer mais fluidez.
   */
  burst(): void {
    this.ripples.push({ radius: this.radius * 0.1, alpha: 0.85 });

    for (const particle of this.particles) {
      particle.radius = this.radius * (0.14 + Math.random() * 0.12);
      particle.life = 1;
      particle.drift = Math.abs(particle.drift) * 3.2;
    }
  }

  /**
   * Desenha um frame.
   *
   * @param deltaFrames frames decorridos a 60 FPS — mantém a velocidade
   *                    constante quando o ecrã corre a 120 Hz ou engasga.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    mode: CoreModeConfig,
    color: RGB,
    deltaFrames: number,
  ): void {
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawSweep(ctx, mode, color, deltaFrames);
    this.updateAndDrawParticles(ctx, mode, color, deltaFrames);
    this.drawLinks(ctx, color);
    this.drawScanner(ctx, mode, color, deltaFrames);
    this.drawRipples(ctx, color, deltaFrames);
  }

  /**
   * Camada 6 — scanner de linhas horizontais.
   *
   * Corre de cima a baixo com opacidade variável, como um leitor a percorrer o
   * núcleo. Só aparece a analisar: é o sinal visual de que a IA está a
   * processar, distinto do radar, que corre sempre.
   */
  private drawScanner(
    ctx: CanvasRenderingContext2D,
    mode: CoreModeConfig,
    color: RGB,
    deltaFrames: number,
  ): void {
    if (!mode.scanner) {
      this.scannerY = 0;
      return;
    }

    this.scannerY = (this.scannerY + SCANNER_SPEED * deltaFrames) % 1;

    const centerBand = this.radius * 1.9;
    const top = this.centerY - centerBand / 2;
    const y = top + this.scannerY * centerBand;

    // Três linhas com espaçamento e opacidade diferentes: uma só linha lia-se
    // como um artefacto, três lêem-se como um varrimento.
    for (const [offset, alpha] of SCANNER_LINES) {
      const lineY = y + offset * this.dpr;
      if (lineY < top || lineY > top + centerBand) continue;

      // Recorta à largura do núcleo àquela altura, para o scanner não
      // ultrapassar o círculo e ficar a flutuar no vazio.
      const dy = lineY - this.centerY;
      const halfWidth = Math.sqrt(Math.max(0, this.radius ** 2 - dy ** 2));
      if (halfWidth <= 0) continue;

      ctx.beginPath();
      ctx.moveTo(this.centerX - halfWidth, lineY);
      ctx.lineTo(this.centerX + halfWidth, lineY);
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = this.dpr;
      ctx.stroke();
    }
  }

  private drawSweep(
    ctx: CanvasRenderingContext2D,
    mode: CoreModeConfig,
    color: RGB,
    deltaFrames: number,
  ): void {
    if (mode.sweepSpeed <= 0) return;

    this.sweep += ((Math.PI * 2) / (SWEEP_PERIOD_MS / 16.7)) * mode.sweepSpeed * deltaFrames;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.sweep);

    const gradient = ctx.createLinearGradient(0, 0, this.radius, 0);
    gradient.addColorStop(0, rgba(color, 0.16));
    gradient.addColorStop(1, rgba(color, 0));

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, this.radius * 0.94, -SWEEP_ARC, 0);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  private updateAndDrawParticles(
    ctx: CanvasRenderingContext2D,
    mode: CoreModeConfig,
    color: RGB,
    deltaFrames: number,
  ): void {
    for (const particle of this.particles) {
      particle.angle += particle.speed * mode.spin * deltaFrames;
      particle.radius += particle.drift * mode.drift * deltaFrames;
      particle.life -= particle.decay * deltaFrames;

      // Renasce ao esgotar a vida ou ao sair da coroa orbital.
      if (particle.life <= 0 || particle.radius < this.radius * 0.12 || particle.radius > this.radius * 1.02) {
        Object.assign(particle, this.spawn());
      }

      particle.x = this.centerX + Math.cos(particle.angle) * particle.radius;
      particle.y = this.centerY + Math.sin(particle.angle) * particle.radius;

      // Partículas que o radar acabou de varrer brilham mais.
      const angleDelta = normalizeAngle(particle.angle - this.sweep);
      const lit = angleDelta < SWEEP_LIT_THRESHOLD ? 1 : 0;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 + lit * 1.3), 0, Math.PI * 2);
      ctx.fillStyle = rgba(
        color,
        (particle.life * (0.35 + particle.shade * 0.4) + lit * 0.5) * mode.density,
      );
      ctx.fill();
    }
  }

  /**
   * Ligações temporárias entre partículas próximas.
   *
   * Percorre de 3 em 3 e olha só para as 8 seguintes: com 300 partículas, o par
   * completo seriam 45 000 comparações por frame. Assim são cerca de 800, e o
   * efeito visual é o mesmo porque as partículas vizinhas no array também
   * costumam estar próximas no ecrã.
   */
  private drawLinks(ctx: CanvasRenderingContext2D, color: RGB): void {
    const maxDistance = this.radius * 0.13;

    for (let i = 0; i < this.particles.length; i += 3) {
      const a = this.particles[i];
      if (!a) continue;

      const limit = Math.min(i + 9, this.particles.length);
      for (let j = i + 1; j < limit; j++) {
        const b = this.particles[j];
        if (!b) continue;

        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance >= maxDistance) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(color, 0.13 * (1 - distance / maxDistance));
        ctx.lineWidth = 0.6 * this.dpr;
        ctx.stroke();
      }
    }
  }

  private drawRipples(ctx: CanvasRenderingContext2D, color: RGB, deltaFrames: number): void {
    this.ripples = this.ripples.filter((ripple) => {
      ripple.radius += this.radius * 0.02 * deltaFrames;
      ripple.alpha -= 0.022 * deltaFrames;
      if (ripple.alpha <= 0) return false;

      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, ripple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, ripple.alpha);
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.stroke();
      return true;
    });
  }

  /** Só para testes. */
  get particleCount(): number {
    return this.particles.length;
  }
}

/** Traz um ângulo para [0, 2π). */
function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

/** Escolhe a contagem de partículas conforme o ecrã e a preferência de movimento. */
export function pickParticleCount(logicalWidth: number, reducedMotion: boolean): number {
  if (reducedMotion) return PARTICLE_COUNTS.reduced;
  return logicalWidth <= 820 ? PARTICLE_COUNTS.small : PARTICLE_COUNTS.full;
}
