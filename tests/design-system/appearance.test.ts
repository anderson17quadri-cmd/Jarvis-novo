import { beforeEach, describe, expect, it } from 'vitest';

import { applyAppearance, useAppearanceStore } from '@/stores/use-appearance-store';
import {
  ANIMATION_PROFILES,
  APPEARANCE_RANGES,
  clampAppearance,
  DEFAULT_APPEARANCE,
  detectAnimationProfile,
  FONT_FAMILY_LABELS,
  FONT_FAMILY_STACKS,
  RADIUS_SCALE,
  WALLPAPER_LABELS,
  type AnimationProfileKind,
  type Appearance,
  type FontFamilyKind,
} from '@/types/appearance';

const root = document.documentElement;

beforeEach(async () => {
  localStorage.clear();
  for (const key of ['wallpaper', 'cursor', 'radius', 'contrast', 'transparency']) {
    delete root.dataset[key];
  }
  root.removeAttribute('style');
  await useAppearanceStore.getState().hydrate();
});

describe('aplicação ao documento', () => {
  it('escreve as escolhas discretas como atributos', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, wallpaper: 'grelha', cursor: 'minimal', radius: 'reto' });

    expect(root.dataset['wallpaper']).toBe('grelha');
    expect(root.dataset['cursor']).toBe('minimal');
    expect(root.dataset['radius']).toBe('reto');
  });

  it('as opções desligadas não deixam atributo — um atributo sem regra é ruído', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, highContrast: true, reduceTransparency: true });
    expect(root.dataset['contrast']).toBe('alto');
    expect(root.dataset['transparency']).toBe('reduzida');

    applyAppearance(DEFAULT_APPEARANCE);
    expect(root.dataset['contrast']).toBeUndefined();
    expect(root.dataset['transparency']).toBeUndefined();
  });

  it('o arredondamento multiplica os tokens em vez de os substituir', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, radius: 'redondo' });
    const redondo = root.style.getPropertyValue('--r-card');

    applyAppearance({ ...DEFAULT_APPEARANCE, radius: 'reto' });
    const reto = root.style.getPropertyValue('--r-card');

    expect(Number.parseFloat(reto)).toBeLessThan(Number.parseFloat(redondo));
    // O "reto" é quase quadrado, mas nunca chega a zero: um canto vivo
    // destoaria de tudo o resto.
    expect(Number.parseFloat(reto)).toBeGreaterThan(0);
  });

  it('a escala e a intensidade viram variáveis', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, uiScale: 1.2, wallpaperIntensity: 0.4 });

    expect(root.style.getPropertyValue('--ui-scale')).toBe('1.2');
    expect(root.style.getPropertyValue('--wp-intensity')).toBe('0.4');
  });

  it('a família tipográfica escreve-se em --font-sans, e nada mais muda por causa dela', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, fontFamily: 'space-grotesk' });

    expect(root.style.getPropertyValue('--font-sans')).toBe(
      FONT_FAMILY_STACKS['space-grotesk'],
    );
    // Trocar de fonte não é trocar de arredondamento nem de escala — só a
    // variável dela muda.
    expect(root.style.getPropertyValue('--ui-scale')).toBe('1');
  });

  it.each(Object.keys(FONT_FAMILY_LABELS) as FontFamilyKind[])(
    'a família "%s" escreve exatamente a sua pilha',
    (kind) => {
      applyAppearance({ ...DEFAULT_APPEARANCE, fontFamily: kind });
      expect(root.style.getPropertyValue('--font-sans')).toBe(FONT_FAMILY_STACKS[kind]);
    },
  );
});

describe('limites', () => {
  it.each([
    ['uiScale', 5, APPEARANCE_RANGES.uiScale.max],
    ['uiScale', -3, APPEARANCE_RANGES.uiScale.min],
    ['coreParticles', 99, APPEARANCE_RANGES.coreParticles.max],
    ['coreSpeed', 99, APPEARANCE_RANGES.coreSpeed.max],
    ['coreSpeed', -1, APPEARANCE_RANGES.coreSpeed.min],
    ['wallpaperIntensity', -1, APPEARANCE_RANGES.wallpaperIntensity.min],
  ] as const)('%s com %s fica em %s', (key, value, expected) => {
    expect(clampAppearance(key, value)).toBe(expected);
  });

  it('um valor inválido cai no predefinido, em vez de deixar a interface partida', () => {
    expect(clampAppearance('uiScale', Number.NaN)).toBe(DEFAULT_APPEARANCE.uiScale);
  });
});

describe('persistência', () => {
  it('a escolha sobrevive a recarregar', async () => {
    useAppearanceStore.getState().set('wallpaper', 'liso');
    useAppearanceStore.getState().set('uiScale', 1.15);
    await useAppearanceStore.getState().persist();

    useAppearanceStore.setState({ appearance: DEFAULT_APPEARANCE });
    await useAppearanceStore.getState().hydrate();

    expect(useAppearanceStore.getState().appearance.wallpaper).toBe('liso');
    expect(useAppearanceStore.getState().appearance.uiScale).toBeCloseTo(1.15);
  });

  it('uma preferência guardada por uma versão antiga não deixa buracos', async () => {
    // Só um campo, como se o resto tivesse sido acrescentado depois.
    localStorage.setItem('jarvis.appearance', JSON.stringify({ wallpaper: 'grelha' }));
    await useAppearanceStore.getState().hydrate();

    const appearance: Appearance = useAppearanceStore.getState().appearance;
    expect(appearance.wallpaper).toBe('grelha');
    expect(appearance.cursor).toBe(DEFAULT_APPEARANCE.cursor);
    expect(appearance.uiScale).toBe(DEFAULT_APPEARANCE.uiScale);
    // Uma cópia de antes de a tipografia existir não pode deixar a variável
    // por escrever — cai no Inter, como quem nunca escolheu outra.
    expect(appearance.fontFamily).toBe('inter');
  });

  it('a família tipográfica sobrevive a recarregar, como o resto', async () => {
    useAppearanceStore.getState().set('fontFamily', 'plex-sans');
    await useAppearanceStore.getState().persist();

    useAppearanceStore.setState({ appearance: DEFAULT_APPEARANCE });
    await useAppearanceStore.getState().hydrate();

    expect(useAppearanceStore.getState().appearance.fontFamily).toBe('plex-sans');
  });

  it('a cor e a velocidade do núcleo sobrevivem a recarregar', async () => {
    useAppearanceStore.getState().set('coreColor', '#ff00aa');
    useAppearanceStore.getState().set('coreSpeed', 1.5);
    await useAppearanceStore.getState().persist();

    useAppearanceStore.setState({ appearance: DEFAULT_APPEARANCE });
    await useAppearanceStore.getState().hydrate();

    expect(useAppearanceStore.getState().appearance.coreColor).toBe('#ff00aa');
    expect(useAppearanceStore.getState().appearance.coreSpeed).toBeCloseTo(1.5);
  });

  it('um valor guardado fora dos limites é trazido para dentro', async () => {
    localStorage.setItem('jarvis.appearance', JSON.stringify({ uiScale: 42 }));
    await useAppearanceStore.getState().hydrate();

    expect(useAppearanceStore.getState().appearance.uiScale).toBe(APPEARANCE_RANGES.uiScale.max);
  });

  it('repor volta a tudo como veio', () => {
    useAppearanceStore.getState().set('cursor', 'sistema');
    useAppearanceStore.getState().reset();

    expect(useAppearanceStore.getState().appearance).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('opções', () => {
  it('cada papel de parede tem etiqueta', () => {
    for (const label of Object.values(WALLPAPER_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('todos os arredondamentos encolhem, e nenhum aumenta', () => {
    for (const scale of Object.values(RADIUS_SCALE)) {
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });

  it('cada família tipográfica tem etiqueta e pilha, e a pilha nomeia a família', () => {
    for (const kind of Object.keys(FONT_FAMILY_LABELS) as FontFamilyKind[]) {
      expect(FONT_FAMILY_LABELS[kind].length).toBeGreaterThan(0);
      // A pilha tem de começar pela própria família, e não por um recurso —
      // senão a "escolha" nunca se via, e a predefinida ganhava sempre.
      expect(FONT_FAMILY_STACKS[kind]).toContain(FONT_FAMILY_LABELS[kind]);
    }
  });
});

describe('perfis de animação', () => {
  it('a predefinição bate com "equilibrado"', () => {
    expect(detectAnimationProfile(DEFAULT_APPEARANCE)).toBe('equilibrado');
  });

  it('aplicar cada perfil deteta-se de volta a ele mesmo', () => {
    for (const kind of Object.keys(ANIMATION_PROFILES) as AnimationProfileKind[]) {
      const appearance: Appearance = { ...DEFAULT_APPEARANCE, ...ANIMATION_PROFILES[kind] };
      expect(detectAnimationProfile(appearance)).toBe(kind);
    }
  });

  it('nenhum perfil é igual a outro — senão dois botões ficariam sempre acesos juntos', () => {
    const vistos = new Set<string>();
    for (const valores of Object.values(ANIMATION_PROFILES)) {
      const chave = JSON.stringify(valores);
      expect(vistos.has(chave)).toBe(false);
      vistos.add(chave);
    }
  });

  it('uma combinação fora de qualquer perfil devolve null ("Personalizado")', () => {
    const appearance: Appearance = { ...DEFAULT_APPEARANCE, coreParticles: 0.8, coreSpeed: 1.3 };
    expect(detectAnimationProfile(appearance)).toBeNull();
  });
});
