import { create } from 'zustand';

import { RADIUS } from '@/design-system/tokens';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  clampAppearance,
  DEFAULT_APPEARANCE,
  RADIUS_SCALE,
  type Appearance,
} from '@/types/appearance';

/**
 * Aparência (Parte 15).
 *
 * Além de guardar as escolhas, aplica-as ao `<html>`: atributos `data-*` para o
 * CSS reagir e variáveis para os valores contínuos. É a mesma ideia do tema —
 * mudar é instantâneo, e nada recompila.
 *
 * A escala e o arredondamento sobrescrevem os tokens em vez de os substituir:
 * `--r-card` continua a ser o token, agora multiplicado. Assim ninguém tem de
 * saber que existe uma preferência para os usar.
 */

interface AppearanceState {
  readonly appearance: Appearance;

  set: <K extends keyof Appearance>(key: K, value: Appearance[K]) => void;
  reset: () => void;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** Raios base, em pixels, lidos uma vez dos tokens. */
const BASE_RADIUS = {
  btn: Number.parseFloat(RADIUS.btn),
  card: Number.parseFloat(RADIUS.card),
  modal: Number.parseFloat(RADIUS.modal),
  input: Number.parseFloat(RADIUS.input),
} as const;

export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  root.dataset['wallpaper'] = appearance.wallpaper;
  root.dataset['cursor'] = appearance.cursor;
  root.dataset['radius'] = appearance.radius;

  // Ausentes quando desligados: um atributo sem regra CSS é ruído, e é a mesma
  // decisão do tema base e do estado normal do sistema.
  if (appearance.highContrast) root.dataset['contrast'] = 'alto';
  else delete root.dataset['contrast'];

  if (appearance.reduceTransparency) root.dataset['transparency'] = 'reduzida';
  else delete root.dataset['transparency'];

  // O filtro entra direto no elemento, e não por uma classe: o CSS não pode
  // compor um `url(#…)` a partir de um atributo, e o filtro tem de valer
  // também para os canvas do núcleo e dos gráficos.
  root.style.filter =
    appearance.daltonism === 'nenhum' ? '' : `url(#daltonismo-${appearance.daltonism})`;

  root.style.setProperty('--wp-intensity', String(appearance.wallpaperIntensity));
  root.style.setProperty('--ui-scale', String(appearance.uiScale));

  const scale = RADIUS_SCALE[appearance.radius];
  root.style.setProperty('--r-btn', `${Math.round(BASE_RADIUS.btn * scale)}px`);
  root.style.setProperty('--r-card', `${Math.round(BASE_RADIUS.card * scale)}px`);
  root.style.setProperty('--r-modal', `${Math.round(BASE_RADIUS.modal * scale)}px`);
  root.style.setProperty('--r-input', `${Math.round(BASE_RADIUS.input * scale)}px`);
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  appearance: DEFAULT_APPEARANCE,

  set: (key, value) =>
    set((state) => {
      const next: Appearance = { ...state.appearance, [key]: value };
      applyAppearance(next);
      return { appearance: next };
    }),

  reset: () => {
    applyAppearance(DEFAULT_APPEARANCE);
    set({ appearance: DEFAULT_APPEARANCE });
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.appearance, get().appearance);
  },

  hydrate: async () => {
    const saved = await storageService.get<Partial<Appearance> | null>(
      STORAGE_KEYS.appearance,
      null,
    );

    // Campos em falta caem no valor base: uma preferência guardada por uma
    // versão anterior não pode deixar a aparência meio definida.
    const appearance: Appearance = {
      ...DEFAULT_APPEARANCE,
      ...saved,
      wallpaperIntensity: clampAppearance(
        'wallpaperIntensity',
        saved?.wallpaperIntensity ?? DEFAULT_APPEARANCE.wallpaperIntensity,
      ),
      coreParticles: clampAppearance(
        'coreParticles',
        saved?.coreParticles ?? DEFAULT_APPEARANCE.coreParticles,
      ),
      uiScale: clampAppearance('uiScale', saved?.uiScale ?? DEFAULT_APPEARANCE.uiScale),
    };

    applyAppearance(appearance);
    set({ appearance });
  },
}));
