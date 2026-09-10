import { beforeEach, describe, expect, it } from 'vitest';

import {
  SoundService,
  SOUND_CATEGORIES,
  SOUND_CATEGORY_DESCRIPTIONS,
  SOUND_CATEGORY_LABELS,
  type SoundCategory,
  type SoundName,
} from '@/services/sound-service';

let sound: SoundService;

beforeEach(() => {
  localStorage.clear();
  sound = new SoundService();
  sound.setEnabled(true);
});

const CATEGORIES = Object.keys(SOUND_CATEGORY_LABELS) as SoundCategory[];
const SOUNDS = Object.keys(SOUND_CATEGORIES) as SoundName[];

describe('categorias', () => {
  it('todos os sons pertencem a uma categoria conhecida', () => {
    for (const name of SOUNDS) {
      expect(CATEGORIES, name).toContain(SOUND_CATEGORIES[name]);
    }
  });

  it('nenhuma categoria fica sem sons — seria um cursor que não faz nada', () => {
    for (const category of CATEGORIES) {
      expect(SOUNDS.some((name) => SOUND_CATEGORIES[name] === category), category).toBe(true);
    }
  });

  it('cada categoria diz o que abrange', () => {
    for (const category of CATEGORIES) {
      expect(SOUND_CATEGORY_DESCRIPTIONS[category]?.length, category).toBeGreaterThan(10);
    }
  });
});

describe('volume', () => {
  it('começa tudo no máximo — o cursor geral é que manda por omissão', () => {
    for (const category of CATEGORIES) {
      expect(sound.volumes[category]).toBe(1);
    }
  });

  it('o volume de um som é o geral vezes o da categoria', () => {
    sound.setVolume(0.5);
    sound.setCategoryVolume('interface', 0.4);

    expect(sound.volumeFor('click')).toBeCloseTo(0.2);
  });

  it('baixar uma categoria não mexe nas outras', () => {
    sound.setCategoryVolume('interface', 0);

    expect(sound.volumeFor('click')).toBe(0);
    expect(sound.volumeFor('notify')).toBeGreaterThan(0);
  });

  it('não aceita valores fora de 0 a 1', () => {
    sound.setCategoryVolume('avisos', 5);
    expect(sound.volumes.avisos).toBe(1);

    sound.setCategoryVolume('avisos', -2);
    expect(sound.volumes.avisos).toBe(0);
  });

  it('tocar com a categoria a zero não rebenta', () => {
    sound.setCategoryVolume('interface', 0);
    expect(() => sound.play('click')).not.toThrow();
  });
});

describe('persistência', () => {
  it('os volumes por categoria sobrevivem a recarregar', async () => {
    sound.setCategoryVolume('sistema', 0.25);
    await sound.persist();

    const other = new SoundService();
    await other.hydrate();

    expect(other.volumes.sistema).toBeCloseTo(0.25);
  });

  it('o formato antigo — sem categorias — continua a ser lido', async () => {
    localStorage.setItem('jarvis.sound', JSON.stringify({ enabled: true, volume: 0.8 }));

    const other = new SoundService();
    await other.hydrate();

    expect(other.isEnabled).toBe(true);
    expect(other.currentVolume).toBeCloseTo(0.8);
    // As categorias em falta assumem o máximo, e não zero: quem já tinha som
    // não pode ficar mudo por atualizar.
    expect(other.volumes.interface).toBe(1);
  });
});
