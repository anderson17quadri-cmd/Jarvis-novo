import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  customSwatches,
  deriveOverrides,
  isCustomThemeId,
  isLightColour,
  luminance,
  parseHex,
  readabilityWarning,
} from '@/types/custom-theme';

const DARK = { accent: '#00CFFF', background: '#05070A', isLight: false };
const LIGHT = { accent: '#0088CC', background: '#F4F7FA', isLight: true };

describe('ler cor', () => {
  it('aceita a forma longa e a curta', () => {
    expect(parseHex('#0088CC')).toEqual({ r: 0, g: 136, b: 204 });
    expect(parseHex('#08C')).toEqual({ r: 0, g: 136, b: 204 });
  });

  it('não precisa do cardinal', () => {
    expect(parseHex('0088CC')).toEqual({ r: 0, g: 136, b: 204 });
  });

  it('recusa o que não for cor', () => {
    for (const value of ['', 'azul', '#12', '#1234567', 'rgb(0,0,0)']) {
      expect(parseHex(value), value).toBeNull();
    }
  });
});

describe('luminância e contraste', () => {
  it('o preto e o branco estão nos extremos', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
  });

  it('branco sobre preto é o contraste máximo', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });

  it('uma cor consigo própria não contrasta nada', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1);
  });

  it('a ordem não importa', () => {
    expect(contrastRatio('#FFFFFF', '#101922')).toBeCloseTo(
      contrastRatio('#101922', '#FFFFFF'),
    );
  });

  it('distingue um fundo claro de um escuro', () => {
    expect(isLightColour('#F4F7FA')).toBe(true);
    expect(isLightColour('#05070A')).toBe(false);
  });
});

describe('derivar os quinze tokens', () => {
  it('devolve todos, sem deixar nenhum por definir', () => {
    const overrides = deriveOverrides(DARK);

    for (const [key, value] of Object.entries(overrides)) {
      expect(value, key).toBeDefined();
      expect(String(value).length, key).toBeGreaterThan(0);
    }
  });

  it('o fundo é exatamente o que se escolheu', () => {
    expect(deriveOverrides(DARK).bg).toBe('#05070A');
  });

  it('num tema escuro as superfícies levantam-se do fundo', () => {
    const { bg, bg2, card, cardHover } = deriveOverrides(DARK);

    const level = (value?: string): number => luminance(parseHex(value ?? '#000')!);
    expect(level(bg2)).toBeGreaterThan(level(bg));
    expect(level(card)).toBeGreaterThan(level(bg2));
    expect(level(cardHover)).toBeGreaterThan(level(card));
  });

  it('num tema claro afundam-se, em vez de levantarem', () => {
    const { bg, card } = deriveOverrides(LIGHT);
    const level = (value?: string): number => luminance(parseHex(value ?? '#000')!);

    expect(level(card)).toBeLessThan(level(bg));
  });

  it('o texto inverte com a base', () => {
    expect(deriveOverrides(DARK).t1).toBe('#FFFFFF');
    expect(deriveOverrides(LIGHT).t1).toBe('#000000');
  });

  it('os três níveis de texto afastam-se por ordem', () => {
    const { t1, t2, t3, bg } = deriveOverrides(DARK);

    expect(contrastRatio(t1!, bg!)).toBeGreaterThan(contrastRatio(t2!, bg!));
    expect(contrastRatio(t2!, bg!)).toBeGreaterThan(contrastRatio(t3!, bg!));
  });

  it('o tint inverte-se — é ele que decide se uma superfície clareia ou escurece', () => {
    expect(deriveOverrides(DARK).tintRgb).toBe('255 255 255');
    expect(deriveOverrides(LIGHT).tintRgb).toBe('10 20 30');
  });

  it('os canais RGB do vidro vêm em três números, como o Tailwind precisa', () => {
    for (const key of ['glassRgb', 'glassDeepRgb'] as const) {
      expect(deriveOverrides(DARK)[key], key).toMatch(/^\d+ \d+ \d+$/);
    }
  });

  it('o neon é mais fundo do que o acento', () => {
    const { accent, neon } = deriveOverrides(DARK);
    expect(luminance(parseHex(neon!)!)).toBeLessThan(luminance(parseHex(accent!)!));
  });

  it('uma cor inválida não rebenta — assume um valor seguro', () => {
    expect(() => deriveOverrides({ ...DARK, background: 'azul' })).not.toThrow();
    expect(deriveOverrides({ ...DARK, background: 'azul' }).bg).toBe('#000000');
  });
});

describe('aviso de legibilidade', () => {
  it('cala-se quando o tema se lê', () => {
    expect(readabilityWarning(DARK)).toBeNull();
    expect(readabilityWarning(LIGHT)).toBeNull();
  });

  it('avisa em texto claro sobre fundo claro', () => {
    const warning = readabilityWarning({ ...DARK, background: '#FFFFFF', isLight: false });
    expect(warning).toContain('base clara');
  });

  it('avisa em texto escuro sobre fundo escuro', () => {
    const warning = readabilityWarning({ ...LIGHT, background: '#000000', isLight: true });
    expect(warning).toContain('base escura');
  });

  it('avisa quando o acento se confunde com o fundo', () => {
    const warning = readabilityWarning({ accent: '#0A0C10', background: '#05070A', isLight: false });
    expect(warning).toContain('acento');
  });
});

describe('identificadores e amostras', () => {
  it('um tema personalizado reconhece-se pelo prefixo', () => {
    expect(isCustomThemeId('custom:t_1')).toBe(true);
    expect(isCustomThemeId('oled')).toBe(false);
  });

  it('as amostras são três, e são cores', () => {
    const swatches = customSwatches({
      ...DARK,
      id: 'custom:x',
      name: 'Meu',
      createdAt: 0,
    });

    expect(swatches).toHaveLength(3);
    for (const swatch of swatches) expect(parseHex(swatch)).not.toBeNull();
  });
});
