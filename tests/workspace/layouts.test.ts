import { describe, expect, it } from 'vitest';

import { getAppDefinition } from '@/apps/registry';
import { overlaps } from '@/components/widgets/grid';
import { builtInLayouts } from '@/data/layouts';
import { THEMES } from '@/design-system/tokens';
import { WALLPAPER_LABELS } from '@/types/appearance';
import { GRID_COLUMNS } from '@/types/widget';
import { ALL_WIDGETS } from '@/widgets/registry';

const LAYOUTS = builtInLayouts();
const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));
const WIDGET_IDS = new Set(ALL_WIDGETS.map((widget) => widget.id));

describe('layouts do sistema', () => {
  it('são os seis da especificação', () => {
    expect(LAYOUTS).toHaveLength(6);
  });

  it.each(LAYOUTS.map((layout) => [layout.name, layout] as const))(
    '%s aponta para coisas que existem',
    (_name, layout) => {
      for (const entry of layout.snapshot.windows) {
        expect(() => getAppDefinition(entry.appId)).not.toThrow();
      }

      for (const widget of layout.snapshot.widgets) {
        expect(WIDGET_IDS.has(widget.id)).toBe(true);
      }

      // Um layout do sistema aponta sempre para um tema do sistema.
      expect(THEME_IDS.has(layout.snapshot.theme)).toBe(true);
      expect(layout.snapshot.ambience.wallpaper in WALLPAPER_LABELS).toBe(true);
    },
  );

  it.each(LAYOUTS.map((layout) => [layout.name, layout] as const))(
    '%s não põe widgets uns por cima dos outros',
    (_name, layout) => {
      const visible = layout.snapshot.widgets
        .filter((widget) => widget.isVisible)
        .map((widget) => widget.placement);

      for (let i = 0; i < visible.length; i += 1) {
        for (let j = i + 1; j < visible.length; j += 1) {
          const a = visible[i];
          const b = visible[j];
          if (!a || !b) continue;
          expect(overlaps(a, b), `${i} e ${j} sobrepõem-se`).toBe(false);
        }
      }
    },
  );

  it.each(LAYOUTS.map((layout) => [layout.name, layout] as const))(
    '%s cabe na largura da grelha',
    (_name, layout) => {
      for (const widget of layout.snapshot.widgets) {
        expect(widget.placement.col + widget.placement.colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
      }
    },
  );

  it('nenhum guarda geometria — a posição calcula-se com o ecrã que há', () => {
    for (const layout of LAYOUTS) {
      for (const entry of layout.snapshot.windows) {
        expect(entry.rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      }
    }
  });

  it('cada um diz o que faz', () => {
    for (const layout of LAYOUTS) {
      expect(layout.description.length).toBeGreaterThan(10);
    }
  });
});
