import { create } from 'zustand';

import { builtInLayouts } from '@/data/layouts';
import { createId } from '@/lib/id';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { captureWorkspace } from '@/services/workspace-service';
import {
  defaultDesktops,
  normaliseSnapshot,
  SAVED_LAYOUT_LIMIT,
  type Desktop,
  type DesktopId,
  type SavedLayout,
  type StoredDesktop,
  type StoredLayout,
  type WorkspaceSnapshot,
} from '@/types/workspace';

/**
 * Desktops e layouts (Partes 6.2 e 15).
 *
 * Guarda **o quê**; quem sabe repor é o `workspace-service`, e quem sabe onde
 * cada janela cabe no ecrã é quem chama. A store não abre janelas nem mexe em
 * temas — pede uma fotografia e devolve outra.
 */

interface WorkspaceState {
  desktops: readonly Desktop[];
  current: DesktopId;
  layouts: readonly SavedLayout[];

  /**
   * Guarda o desktop atual e devolve a fotografia do que se vai abrir.
   *
   * Devolve `null` quando já se está nesse desktop, ou quando ele nunca foi
   * visitado — nesse caso quem chama deixa o ecrã como está, e o desktop novo
   * fica a ser o que estava à vista. Herdar é menos violento do que abrir um
   * ecrã pelado.
   */
  switchTo: (id: DesktopId) => WorkspaceSnapshot | null;
  renameDesktop: (id: DesktopId, name: string) => void;
  /** Grava o estado atual no desktop ativo, sem mudar de desktop. */
  syncCurrent: () => void;

  saveLayout: (name: string, description?: string) => SavedLayout;
  removeLayout: (id: string) => void;
  getLayout: (id: string) => SavedLayout | null;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/**
 * O que está em disco.
 *
 * As fotografias leem-se como `Stored*` e não como as definitivas: um layout
 * guardado por uma versão anterior não tem os campos novos, e ler para o tipo
 * completo era o compilador a garantir uma coisa que o ficheiro não cumpre.
 */
interface PersistedWorkspace {
  readonly desktops: readonly StoredDesktop[];
  readonly current: DesktopId;
  /** Só os do utilizador. Os do sistema vêm do código, e podem mudar entre versões. */
  readonly layouts: readonly StoredLayout[];
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  desktops: defaultDesktops(),
  current: 1,
  layouts: builtInLayouts(),

  switchTo: (id) => {
    const state = get();
    if (id === state.current) return null;

    const outgoing = captureWorkspace();
    const target = state.desktops.find((desktop) => desktop.id === id);

    set({
      current: id,
      desktops: state.desktops.map((desktop) =>
        desktop.id === state.current ? { ...desktop, snapshot: outgoing } : desktop,
      ),
    });

    eventBus.emit('desktop:mudou', { desktop: id });
    logService.audit(`Mudar para o desktop ${id}`, 'executado');
    void get().persist();

    // Um desktop por estrear herda o que estava à vista, e passa a ser dele a
    // partir do primeiro toque.
    return target?.snapshot ?? null;
  },

  renameDesktop: (id, name) => {
    const clean = name.trim();
    if (clean.length === 0) return;

    set((state) => ({
      desktops: state.desktops.map((desktop) =>
        desktop.id === id ? { ...desktop, name: clean } : desktop,
      ),
    }));

    void get().persist();
  },

  syncCurrent: () => {
    const snapshot = captureWorkspace();

    set((state) => ({
      desktops: state.desktops.map((desktop) =>
        desktop.id === state.current ? { ...desktop, snapshot } : desktop,
      ),
    }));

    void get().persist();
  },

  saveLayout: (name, description = '') => {
    const saved: SavedLayout = {
      id: createId('layout'),
      name: name.trim().length > 0 ? name.trim() : 'Layout sem nome',
      description,
      createdAt: Date.now(),
      snapshot: captureWorkspace(),
      isBuiltIn: false,
    };

    set((state) => {
      const mine = state.layouts.filter((entry) => !entry.isBuiltIn);
      const builtIn = state.layouts.filter((entry) => entry.isBuiltIn);

      return { layouts: [...builtIn, saved, ...mine].slice(0, builtIn.length + SAVED_LAYOUT_LIMIT) };
    });

    logService.audit(`Guardar o layout "${saved.name}"`, 'executado');
    void get().persist();
    return saved;
  },

  removeLayout: (id) => {
    set((state) => ({
      // Os do sistema não se apagam: voltariam no arranque seguinte, vindos do
      // código, e a interface parecia ignorar o pedido.
      layouts: state.layouts.filter((entry) => entry.id !== id || entry.isBuiltIn),
    }));

    void get().persist();
  },

  getLayout: (id) => get().layouts.find((entry) => entry.id === id) ?? null,

  persist: async () => {
    const state = get();
    await storageService.set<PersistedWorkspace>(STORAGE_KEYS.workspace, {
      desktops: state.desktops,
      current: state.current,
      layouts: state.layouts.filter((entry) => !entry.isBuiltIn),
    });
  },

  hydrate: async () => {
    const saved = await storageService.get<PersistedWorkspace | null>(STORAGE_KEYS.workspace, null);
    if (!saved) return;

    const known = new Set(defaultDesktops().map((desktop) => desktop.id));

    set({
      desktops: defaultDesktops().map((fallback) => {
        const stored = saved.desktops.find((desktop) => desktop.id === fallback.id);
        if (!stored) return fallback;

        return {
          ...stored,
          snapshot: stored.snapshot === null ? null : normaliseSnapshot(stored.snapshot),
        };
      }),
      current: known.has(saved.current) ? saved.current : 1,
      // Os do sistema vêm sempre do código: assim uma correção num layout
      // predefinido chega a quem já tinha a versão antiga guardada.
      layouts: [
        ...builtInLayouts(),
        ...saved.layouts
          .filter((entry) => !entry.isBuiltIn)
          .map((entry) => ({ ...entry, snapshot: normaliseSnapshot(entry.snapshot) })),
      ],
    });
  },
}));

/** O desktop ativo. */
export function selectCurrentDesktop(state: WorkspaceState): Desktop {
  return (
    state.desktops.find((desktop) => desktop.id === state.current) ?? {
      id: state.current,
      name: `Desktop ${state.current}`,
      snapshot: null,
    }
  );
}
