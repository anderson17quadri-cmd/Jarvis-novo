import { beforeEach, describe, expect, it } from 'vitest';

import { builtInLayouts } from '@/data/layouts';
import { soundService } from '@/services/sound-service';
import { applyWorkspace, captureWorkspace } from '@/services/workspace-service';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { AMBIENCE_KEYS, DEFAULT_APPEARANCE } from '@/types/appearance';
import { normaliseSnapshot } from '@/types/workspace';
import type { WindowRect } from '@/types/window';

/**
 * Perfis completos (Parte 15 §Perfis).
 *
 * O que se testa aqui não é "guardar e repor" — isso já estava. É a fronteira:
 * o que um perfil leva, o que **nunca** leva, e o que uma fotografia guardada
 * por uma versão anterior tem o direito de não mexer.
 */

const RECT: WindowRect = { x: 0, y: 0, width: 500, height: 400 };
const rectFor = (): WindowRect => RECT;

beforeEach(async () => {
  localStorage.clear();
  useWindowStore.setState({ windows: [] });
  useThemeStore.setState({ theme: 'classic' });
  await useWidgetStore.getState().hydrate();
  await useAppearanceStore.getState().hydrate();
  await usePluginStore.getState().hydrate();
  await soundService.hydrate();
});

describe('o que um perfil guarda', () => {
  it('apanha o ambiente inteiro, e não só o papel de parede', () => {
    const appearance = useAppearanceStore.getState();
    appearance.set('wallpaper', 'liso');
    appearance.set('coreParticles', 0.5);
    appearance.set('cursor', 'minimal');
    appearance.set('radius', 'reto');
    appearance.set('wallpaperIntensity', 0.4);
    appearance.set('fontFamily', 'plex-sans');

    expect(captureWorkspace().ambience).toEqual({
      wallpaper: 'liso',
      wallpaperIntensity: 0.4,
      coreParticles: 0.5,
      coreColor: null,
      coreSpeed: 1,
      cursor: 'minimal',
      radius: 'reto',
      fontFamily: 'plex-sans',
    });
  });

  it('apanha o som, geral e por categoria', () => {
    soundService.setEnabled(true);
    soundService.setVolume(0.3);
    soundService.setCategoryVolume('interface', 0);

    expect(captureWorkspace().sound).toEqual({
      isEnabled: true,
      volume: 0.3,
      categoryVolumes: { interface: 0, avisos: 1, sistema: 1 },
    });
  });

  it('apanha os plugins instalados, por ordem estável', () => {
    const plugins = captureWorkspace().plugins;
    const ids = plugins.map((entry) => entry.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual([...ids].sort());
    // Tirar a mesma fotografia duas vezes tem de dar o mesmo ficheiro.
    expect(captureWorkspace().plugins).toEqual(plugins);
  });

  it('a fotografia do som é uma cópia: mexer no cursor depois não a muda', () => {
    soundService.setVolume(0.8);
    const snapshot = captureWorkspace();

    soundService.setCategoryVolume('avisos', 0);

    expect(snapshot.sound?.categoryVolumes.avisos).toBe(1);
  });
});

describe('o que um perfil nunca leva', () => {
  it('a acessibilidade não entra na fotografia', () => {
    const appearance = useAppearanceStore.getState();
    appearance.set('highContrast', true);
    appearance.set('daltonism', 'deuteranopia');
    appearance.set('uiScale', 1.25);
    appearance.set('idleLockMinutes', 1);

    const captured = captureWorkspace().ambience;

    // A asserção é sobre as chaves, e não sobre os valores: uma chave nova em
    // `AMBIENCE_KEYS` que fosse de acessibilidade cai aqui.
    expect(Object.keys(captured).sort()).toEqual([...AMBIENCE_KEYS].sort());
    expect(AMBIENCE_KEYS).not.toContain('highContrast');
    expect(AMBIENCE_KEYS).not.toContain('daltonism');
    expect(AMBIENCE_KEYS).not.toContain('uiScale');
    expect(AMBIENCE_KEYS).not.toContain('idleLockMinutes');
  });

  it('aplicar um perfil não desfaz a correção de daltonismo nem o contraste', () => {
    const snapshot = captureWorkspace();

    const appearance = useAppearanceStore.getState();
    appearance.set('daltonism', 'protanopia');
    appearance.set('highContrast', true);
    appearance.set('uiScale', 1.3);
    appearance.set('idleLockMinutes', 5);

    applyWorkspace(snapshot, rectFor, 'perfil');

    const after = useAppearanceStore.getState().appearance;
    expect(after.daltonism).toBe('protanopia');
    expect(after.highContrast).toBe(true);
    expect(after.uiScale).toBe(1.3);
    expect(after.idleLockMinutes).toBe(5);
  });
});

describe('âmbito: desktop contra perfil', () => {
  it('saltar de desktop repõe o ambiente mas não mexe no volume', () => {
    soundService.setEnabled(true);
    soundService.setVolume(0.2);
    useAppearanceStore.getState().set('wallpaper', 'grelha');
    const snapshot = captureWorkspace();

    soundService.setVolume(0.9);
    useAppearanceStore.getState().set('wallpaper', 'nebulosa');

    applyWorkspace(snapshot, rectFor, 'desktop');

    expect(useAppearanceStore.getState().appearance.wallpaper).toBe('grelha');
    expect(soundService.currentVolume).toBe(0.9);
  });

  it('aplicar um perfil repõe o volume', () => {
    soundService.setEnabled(true);
    soundService.setVolume(0.2);
    const snapshot = captureWorkspace();

    soundService.setVolume(0.9);
    applyWorkspace(snapshot, rectFor, 'perfil');

    expect(soundService.currentVolume).toBe(0.2);
  });

  it('saltar de desktop não desliga plugins', () => {
    const [first] = captureWorkspace().plugins;
    if (!first) throw new Error('sem plugins instalados para o teste');

    usePluginStore.getState().setEnabled(first.id, false);
    const snapshot = captureWorkspace();

    usePluginStore.getState().setEnabled(first.id, true);
    applyWorkspace(snapshot, rectFor, 'desktop');

    expect(usePluginStore.getState().installed[first.id]?.isEnabled).toBe(true);
  });

  it('aplicar um perfil repõe que plugins estavam ativos', () => {
    const [first] = captureWorkspace().plugins;
    if (!first) throw new Error('sem plugins instalados para o teste');

    usePluginStore.getState().setEnabled(first.id, false);
    const snapshot = captureWorkspace();

    usePluginStore.getState().setEnabled(first.id, true);
    applyWorkspace(snapshot, rectFor, 'perfil');

    expect(usePluginStore.getState().installed[first.id]?.isEnabled).toBe(false);
  });

  it('um plugin instalado depois de o perfil ser guardado fica como está', () => {
    const snapshot = normaliseSnapshot({
      ...captureWorkspace(),
      // A fotografia não conhecia nenhum plugin.
      plugins: [],
    });

    const [first] = Object.values(usePluginStore.getState().installed);
    if (!first) throw new Error('sem plugins instalados para o teste');
    usePluginStore.getState().setEnabled(first.id, true);

    applyWorkspace(snapshot, rectFor, 'perfil');

    expect(usePluginStore.getState().installed[first.id]?.isEnabled).toBe(true);
  });
});

describe('fotografias de versões anteriores', () => {
  it('o papel de parede solto vira ambiente, e o resto fica no base', () => {
    const snapshot = normaliseSnapshot({ theme: 'oled', wallpaper: 'liso' });

    expect(snapshot.ambience.wallpaper).toBe('liso');
    expect(snapshot.ambience.coreParticles).toBe(DEFAULT_APPEARANCE.coreParticles);
    expect(snapshot.ambience.cursor).toBe(DEFAULT_APPEARANCE.cursor);
  });

  it('sem som guardado, aplicar não mexe no som', () => {
    const snapshot = normaliseSnapshot({ theme: 'classic', wallpaper: 'liso' });
    expect(snapshot.sound).toBeNull();

    soundService.setEnabled(true);
    soundService.setVolume(0.75);

    applyWorkspace(snapshot, rectFor, 'perfil');

    expect(soundService.isEnabled).toBe(true);
    expect(soundService.currentVolume).toBe(0.75);
  });

  it('uma fotografia vazia não rebenta e deixa o ecrã sem janelas', () => {
    useWindowStore.getState().open('emails', 'Emails', RECT);

    applyWorkspace(normaliseSnapshot({}), rectFor, 'perfil');

    expect(useWindowStore.getState().windows).toHaveLength(0);
  });
});

describe('os layouts do sistema', () => {
  const LAYOUTS = builtInLayouts();

  it.each(LAYOUTS.map((layout) => [layout.name, layout] as const))(
    '%s traz um ambiente dentro dos limites',
    (_name, layout) => {
      const { ambience } = layout.snapshot;

      expect(ambience.wallpaperIntensity).toBeGreaterThanOrEqual(0);
      expect(ambience.wallpaperIntensity).toBeLessThanOrEqual(1);
      expect(ambience.coreParticles).toBeGreaterThanOrEqual(0.25);
      expect(ambience.coreParticles).toBeLessThanOrEqual(1.5);
      expect(ambience.coreSpeed).toBeGreaterThanOrEqual(0.5);
      expect(ambience.coreSpeed).toBeLessThanOrEqual(2);
    },
  );

  it.each(LAYOUTS.map((layout) => [layout.name, layout] as const))(
    '%s traz som, e nenhum mexe em plugins',
    (_name, layout) => {
      expect(layout.snapshot.sound).not.toBeNull();
      // Um perfil que vem do código não sabe o que a pessoa instalou.
      expect(layout.snapshot.plugins).toEqual([]);
    },
  );

  it('os perfis de foco calam a interface, e nem todos calam os avisos', () => {
    const byId = new Map(LAYOUTS.map((layout) => [layout.id, layout]));

    // "Estudos" é silêncio completo: nem contexto de áudio se cria.
    expect(byId.get('estudos')?.snapshot.sound?.isEnabled).toBe(false);

    // "Programação" cala os cliques e mantém os avisos audíveis — é a
    // diferença entre concentração e ficar sem saber que algo chegou.
    const programacao = byId.get('programacao')?.snapshot.sound;
    expect(programacao?.categoryVolumes.interface).toBe(0);
    expect(programacao?.categoryVolumes.avisos).toBe(1);
  });
});
