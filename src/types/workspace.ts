import type { ThemeId } from '@/design-system/tokens';
import type { SoundSnapshot } from '@/services/sound-service';
import { DEFAULT_AMBIENCE, type Ambience, type WallpaperKind } from './appearance';
import type { PersistedWidgetLayout } from './widget';
import type { PersistedWindowLayout } from './window';

/**
 * Desktops e layouts guardados (Partes 6.2 e 15).
 *
 * Um **desktop** é um espaço de trabalho ativo: janelas, widgets, tema e
 * ambiente próprios, entre os quais se salta. Um **layout** é o mesmo
 * conteúdo, mas guardado com um nome para se aplicar quando se quiser.
 *
 * São a mesma estrutura de dados de propósito — um layout guardado é uma
 * fotografia de um desktop, e guardar o estado atual é copiá-la.
 *
 * O que os separa é o **âmbito** com que se aplicam, e não o que guardam: som
 * e plugins só se repõem a partir de um perfil. Ver `WorkspaceScope`.
 */

export type DesktopId = 1 | 2 | 3 | 4;

export const DESKTOP_IDS: readonly DesktopId[] = [1, 2, 3, 4];

/** Que plugins estavam ativos quando a fotografia foi tirada. */
export interface PluginSnapshotEntry {
  readonly id: string;
  readonly isEnabled: boolean;
}

/** Tudo o que define um espaço de trabalho. */
export interface WorkspaceSnapshot {
  readonly windows: readonly PersistedWindowLayout[];
  readonly widgets: readonly PersistedWidgetLayout[];
  readonly theme: ThemeId;
  readonly ambience: Ambience;
  /**
   * `null` quer dizer "este perfil não mexe no som".
   *
   * É o que acontece a um layout guardado antes de os perfis levarem som:
   * inventar-lhe um volume era desligar o aviso a quem contava com ele.
   */
  readonly sound: SoundSnapshot | null;
  /**
   * Vazio quer dizer "não mexe em plugins", pela mesma razão.
   *
   * Aplicar um perfil só toca nos plugins que a fotografia conhecia: um
   * instalado depois de o perfil ser guardado fica como está, em vez de se
   * desligar por ter sido guardado num mundo onde ainda não existia.
   */
  readonly plugins: readonly PluginSnapshotEntry[];
}

/**
 * De onde vem a fotografia que se está a aplicar.
 *
 * Saltar de desktop é mudar de espaço, não de definições — ninguém espera que
 * ir ao desktop 3 lhe mude o volume ou lhe desligue um plugin. Um perfil
 * guardado com um nome é uma escolha explícita, e esse repõe tudo.
 */
export type WorkspaceScope = 'desktop' | 'perfil';

/**
 * Uma fotografia como pode estar em disco.
 *
 * Versões anteriores gravaram menos campos, e uma delas gravou o papel de
 * parede solto em vez do ambiente inteiro. Ler para este tipo em vez de para
 * `WorkspaceSnapshot` obriga a passar por `normaliseSnapshot` antes de usar.
 */
export type StoredSnapshot = Partial<WorkspaceSnapshot> & {
  /** Formato antigo: só o papel de parede, sem o resto do ambiente. */
  readonly wallpaper?: WallpaperKind;
};

/** Tema de recurso quando a fotografia guardada não tinha nenhum. */
const FALLBACK_THEME: ThemeId = 'classic';

/** Traz uma fotografia guardada para o formato atual. */
export function normaliseSnapshot(stored: StoredSnapshot): WorkspaceSnapshot {
  return {
    windows: stored.windows ?? [],
    widgets: stored.widgets ?? [],
    theme: stored.theme ?? FALLBACK_THEME,
    // O papel de parede solto é o único campo do ambiente que se sabe; os
    // outros três voltam ao base, que é o que a pessoa tinha quando o guardou.
    ambience: stored.ambience ?? {
      ...DEFAULT_AMBIENCE,
      wallpaper: stored.wallpaper ?? DEFAULT_AMBIENCE.wallpaper,
    },
    sound: stored.sound ?? null,
    plugins: stored.plugins ?? [],
  };
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

/** Um desktop como pode estar em disco. */
export type StoredDesktop = Omit<Desktop, 'snapshot'> & {
  readonly snapshot: StoredSnapshot | null;
};

/** Um layout como pode estar em disco. */
export type StoredLayout = Omit<SavedLayout, 'snapshot'> & {
  readonly snapshot: StoredSnapshot;
};

/** Quantos layouts guardados pelo utilizador se mantêm. */
export const SAVED_LAYOUT_LIMIT = 20;

export function defaultDesktops(): readonly Desktop[] {
  return DESKTOP_IDS.map((id) => ({ id, name: `Desktop ${id}`, snapshot: null }));
}
