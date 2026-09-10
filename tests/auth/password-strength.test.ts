import { describe, expect, it } from 'vitest';

import { measurePasswordStrength } from '@/components/auth/password-strength';
import { CORE_SIZES, pickCoreSize } from '@/components/ai-core/core-size';

describe('força da palavra-passe', () => {
  it('a vazia não mostra rótulo nem barra', () => {
    const result = measurePasswordStrength('');
    expect(result.level).toBe('vazia');
    expect(result.label).toBe('');
    expect(result.percent).toBe(0);
  });

  it.each([
    ['abc', 'fraca'],
    // Oito minúsculas continuam fracas: só o comprimento não chega.
    ['abcdefgh', 'fraca'],
    ['abcdefghijkl', 'media'],
    ['Abcdefgh1', 'forte'],
    ['Abcdefghijk1!', 'excelente'],
  ])('classifica "%s" como %s', (password, expected) => {
    expect(measurePasswordStrength(password).level).toBe(expected);
  });

  it('a percentagem sobe com a força', () => {
    const weak = measurePasswordStrength('abc').percent;
    const strong = measurePasswordStrength('Abcdefghijk1!').percent;
    expect(strong).toBeGreaterThan(weak);
  });

  it('nunca ultrapassa 100', () => {
    expect(measurePasswordStrength('A'.repeat(200) + 'a1!').percent).toBeLessThanOrEqual(100);
  });
});

describe('dimensões do núcleo por dispositivo (Parte 8)', () => {
  it.each([
    [2560, CORE_SIZES.desktop],
    [1920, CORE_SIZES.desktop],
    [1440, CORE_SIZES.notebook],
    [768, CORE_SIZES.tablet],
    [412, CORE_SIZES.mobile],
  ])('a %ipx de largura usa %ipx', (viewportWidth, expected) => {
    expect(pickCoreSize(viewportWidth)).toBe(expected);
  });

  it('os escalões diminuem sempre, nunca saltam para trás', () => {
    const sizes = [2560, 1920, 1440, 1000, 768, 600, 412, 320].map(pickCoreSize);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeLessThanOrEqual(sizes[i - 1]!);
    }
  });
});
