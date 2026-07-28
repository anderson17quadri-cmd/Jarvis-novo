import type { ThemeId } from '@/design-system/tokens';
import type { WallpaperKind } from './appearance';
import type { PersistedWidgetLayout } from './widget';
import type { PersistedWindowLayout } from './window';

/**
 * Desktops e layouts guardados (Partes 6.2 e 15).
 *
 * Um **desktop** é um espaço de trabalho ativo: janelas, widgets, tema e papel
 * de parede próprios, entre os quais se salta. Um **layout** é o mesmo
 * conteúdo, mas guardado com um nome para se aplicar quando se quiser.
 *
 * São a mesma estrutura de dados de propósito — um layout guardado é uma
 * fotografia de um desktop, e guardar o estado atual é copiá-la.
 */

export type DesktopId = 1 | 2 | 3 | 4;

export const DESKTOP_IDS: readonly DesktopId[] = [1, 2, 3, 4];

/** Tudo o que define um espaço de trabalho. */
export interface WorkspaceSnapshot {
  readonly windows: readonly PersistedWindowLayout[];
  readonly widgets: readonly PersistedWidgetLayout[];
  readonly theme: ThemeId;
  readonly wallpaper: WallpaperKind;
}

export interface Desktop {
  readonly id: DesktopId;
  readonly name: string;
  /**
   * `null` até se lá entrar pela primeira vez.
   *
   * Distingue "desktop vazio de propósito" de "desktop ainda por estrear": o
   * segundo herda o arranjo predefinido em vez de abrir um ecrã pelado.
   */
  readonly snapshot: WorkspaceSnapshot | null;
}

export interface SavedLayout {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: number;
  readonly snapshot: WorkspaceSnapshot;
  /** Os que vêm com o sistema não se apagam, mas podem ser substituídos. */
  readonly isBuiltIn: boolean;
}

/** Quantos layouts guardados pelo utilizador se mantêm. */
export const SAVED_LAYOUT_LIMIT = 20;

export function defaultDesktops(): readonly Desktop[] {
  return DESKTOP_IDS.map((id) => ({ id, name: `Desktop ${id}`, snapshot: null }));
}
