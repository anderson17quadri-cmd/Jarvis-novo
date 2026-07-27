import { describe, expect, it } from 'vitest';

import { CORE_MODES } from '@/components/ai-core/ai-core-modes';
import { PARTICLE_COUNTS, ParticleField, pickParticleCount } from '@/components/ai-core/particle-field';
import { parseHexColor } from '@/components/shell/wallpaper-field';
import { BREAKPOINTS } from '@/design-system/tokens';

describe('a contagem de partículas adapta-se ao contexto', () => {
  it('usa a contagem cheia num ecrã grande', () => {
    expect(pickParticleCount(1920, false)).toBe(PARTICLE_COUNTS.full);
  });

  it('corta a contagem em ecrãs pequenos, para segurar os 60 FPS', () => {
    expect(pickParticleCount(BREAKPOINTS.compact, false)).toBe(PARTICLE_COUNTS.small);
    expect(PARTICLE_COUNTS.small).toBeLessThan(PARTICLE_COUNTS.full);
  });

  it('com movimento reduzido usa o mínimo, mesmo num ecrã grande', () => {
    expect(pickParticleCount(2560, true)).toBe(PARTICLE_COUNTS.reduced);
  });
});

describe('os modos do núcleo', () => {
  it('cobrem os cinco estados', () => {
    expect(Object.keys(CORE_MODES).sort()).toEqual([
      'error',
      'idle',
      'listening',
      'speaking',
      'thinking',
    ]);
  });

  it('param o radar em falha', () => {
    expect(CORE_MODES.error.sweepSpeed).toBe(0);
  });

  it('puxam as partículas para dentro a ouvir e para fora a responder', () => {
    expect(CORE_MODES.listening.drift).toBeLessThan(0);
    expect(CORE_MODES.speaking.drift).toBeGreaterThan(0);
  });

  it('fixam a cor dos estados críticos, para se lerem em qualquer tema', () => {
    // `null` significa "segue o acento do tema".
    expect(CORE_MODES.idle.color).toBeNull();
    expect(CORE_MODES.listening.color).toBeNull();
    expect(CORE_MODES.thinking.color).not.toBeNull();
    expect(CORE_MODES.speaking.color).not.toBeNull();
    expect(CORE_MODES.error.color).not.toBeNull();
  });
});

describe('o campo orbital desenha sem rebentar', () => {
  /** Contexto de canvas mínimo — o jsdom não implementa um a sério. */
  function createStubContext(): CanvasRenderingContext2D {
    const gradient = { addColorStop: () => undefined };
    const noop = (): void => undefined;

    return {
      clearRect: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      closePath: noop,
      fill: noop,
      stroke: noop,
      createLinearGradient: () => gradient,
    } as unknown as CanvasRenderingContext2D;
  }

  it('povoa o campo com a contagem pedida', () => {
    const field = new ParticleField();
    field.resize(800, 800, 2, 120);
    expect(field.particleCount).toBe(120);
  });

  it('aguenta mil frames em todos os modos', () => {
    const field = new ParticleField();
    field.resize(600, 600, 1, 80);
    const ctx = createStubContext();
    const color = parseHexColor('#00CFFF');

    for (const mode of Object.values(CORE_MODES)) {
      for (let frame = 0; frame < 200; frame++) {
        expect(() => field.draw(ctx, mode, color, 1)).not.toThrow();
      }
    }

    // As partículas renascem em vez de desaparecerem: a contagem é estável.
    expect(field.particleCount).toBe(80);
  });

  it('aceita ondas de clique sem acumular', () => {
    const field = new ParticleField();
    field.resize(400, 400, 1, 20);
    const ctx = createStubContext();
    const color = parseHexColor('#00CFFF');

    for (let i = 0; i < 5; i++) field.addRipple();
    // Ao fim de frames suficientes todas as ondas se apagam.
    for (let frame = 0; frame < 200; frame++) field.draw(ctx, CORE_MODES.idle, color, 1);

    expect(() => field.draw(ctx, CORE_MODES.idle, color, 1)).not.toThrow();
  });
});

describe('parseHexColor', () => {
  it.each([
    ['#00CFFF', { r: 0, g: 207, b: 255 }],
    ['#0CF', { r: 0, g: 204, b: 255 }],
    ['22E5A0', { r: 34, g: 229, b: 160 }],
  ])('lê %s', (input, expected) => {
    expect(parseHexColor(input)).toEqual(expected);
  });

  it('cai no ciano quando o valor não presta', () => {
    expect(parseHexColor('não é uma cor')).toEqual({ r: 0, g: 207, b: 255 });
  });
});
