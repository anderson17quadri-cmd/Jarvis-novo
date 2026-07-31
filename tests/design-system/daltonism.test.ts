import { beforeEach, describe, expect, it } from 'vitest';

import { applyAppearance, useAppearanceStore } from '@/stores/use-appearance-store';
import {
  DALTONISM_DESCRIPTIONS,
  DALTONISM_LABELS,
  DALTONISM_MATRICES,
  DEFAULT_APPEARANCE,
  type DaltonismKind,
} from '@/types/appearance';

const KINDS = Object.keys(DALTONISM_LABELS) as DaltonismKind[];

beforeEach(() => {
  localStorage.clear();
  useAppearanceStore.getState().reset();
});

describe('matrizes de cor', () => {
  it('há uma por tipo, e cada uma tem os 20 números que o feColorMatrix pede', () => {
    for (const kind of KINDS) {
      expect(DALTONISM_MATRICES[kind], kind).toHaveLength(20);
    }
  });

  it('cada tipo tem etiqueta e explicação', () => {
    for (const kind of KINDS) {
      expect(DALTONISM_LABELS[kind]?.length, kind).toBeGreaterThan(0);
      expect(DALTONISM_DESCRIPTIONS[kind]?.length, kind).toBeGreaterThan(10);
    }
  });

  it('"sem correção" é a identidade — não mexe em cor nenhuma', () => {
    expect(DALTONISM_MATRICES.nenhum).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ]);
  });

  it('as três correções mexem mesmo — nenhuma é a identidade disfarçada', () => {
    for (const kind of KINDS.filter((entry) => entry !== 'nenhum')) {
      expect(DALTONISM_MATRICES[kind], kind).not.toEqual(DALTONISM_MATRICES.nenhum);
    }
  });

  it('cada linha soma perto de 1 — corrigir não é escurecer nem queimar a imagem', () => {
    for (const kind of KINDS) {
      const matrix = DALTONISM_MATRICES[kind];

      for (let row = 0; row < 3; row += 1) {
        const sum = matrix.slice(row * 5, row * 5 + 3).reduce((total, value) => total + value, 0);
        expect(sum, `${kind} linha ${row}`).toBeCloseTo(1, 1);
      }
    }
  });

  it('o canal alfa fica intacto — corrigir cor não pode mexer na transparência', () => {
    for (const kind of KINDS) {
      expect(DALTONISM_MATRICES[kind]?.slice(15), kind).toEqual([0, 0, 0, 1, 0]);
    }
  });
});

describe('aplicar', () => {
  it('sem correção não deixa filtro nenhum no documento', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, daltonism: 'nenhum' });
    expect(document.documentElement.style.filter).toBe('');
  });

  it('com correção aponta para o filtro certo', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, daltonism: 'deuteranopia' });
    expect(document.documentElement.style.filter).toBe('url(#daltonismo-deuteranopia)');
  });

  it('trocar de tipo substitui em vez de acumular', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, daltonism: 'protanopia' });
    applyAppearance({ ...DEFAULT_APPEARANCE, daltonism: 'tritanopia' });

    expect(document.documentElement.style.filter).toBe('url(#daltonismo-tritanopia)');
  });

  it('desligar limpa mesmo', () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, daltonism: 'protanopia' });
    applyAppearance({ ...DEFAULT_APPEARANCE, daltonism: 'nenhum' });

    expect(document.documentElement.style.filter).toBe('');
  });

  it('a escolha sobrevive a recarregar', async () => {
    useAppearanceStore.getState().set('daltonism', 'tritanopia');
    await useAppearanceStore.getState().persist();

    useAppearanceStore.setState({ appearance: DEFAULT_APPEARANCE });
    await useAppearanceStore.getState().hydrate();

    expect(useAppearanceStore.getState().appearance.daltonism).toBe('tritanopia');
  });
});
