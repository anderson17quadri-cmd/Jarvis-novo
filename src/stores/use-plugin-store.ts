import { create } from 'zustand';

import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

/**
 * Estado da loja de plugins.
 *
 * **Só interface.** Instalar acrescenta uma entrada a este mapa e mais nada:
 * não descarrega, não verifica assinatura, não executa código. O carregamento
 * real precisa de sandbox e de acesso ao sistema de ficheiros — bloqueado até
 * haver PC (ver `SPEC.md` §Estado de verificação).
 *
 * Guardar apenas o `id` e não o objeto do catálogo é intencional: assim, um
 * plugin que mude de versão ou de descrição entre versões do sistema é lido do
 * catálogo atual, e não de uma cópia velha em disco.
 */

export interface InstalledPlugin {
  readonly id: string;
  readonly installedAt: number;
  readonly isEnabled: boolean;
}

interface PluginState {
  readonly installed: Readonly<Record<string, InstalledPlugin>>;

  install: (id: string) => void;
  uninstall: (id: string) => void;
  setEnabled: (id: string, isEnabled: boolean) => void;
  toggleEnabled: (id: string) => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** Os que vêm com o sistema: já instalados, ativos, e não se removem. */
function builtInState(): Record<string, InstalledPlugin> {
  const state: Record<string, InstalledPlugin> = {};

  for (const entry of PLUGIN_CATALOG) {
    if (!entry.isBuiltIn) continue;
    state[entry.id] = { id: entry.id, installedAt: 0, isEnabled: true };
  }

  return state;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  installed: builtInState(),

  install: (id) =>
    set((state) => {
      if (state.installed[id]) return state;

      return {
        installed: {
          ...state.installed,
          [id]: { id, installedAt: Date.now(), isEnabled: true },
        },
      };
    }),

  uninstall: (id) =>
    set((state) => {
      // Os do sistema não se removem: a regra vive aqui e não no botão, para
      // não depender de a interface se lembrar de a aplicar.
      const entry = PLUGIN_CATALOG.find((candidate) => candidate.id === id);
      if (entry?.isBuiltIn) return state;

      const { [id]: removed, ...rest } = state.installed;
      if (!removed) return state;

      return { installed: rest };
    }),

  setEnabled: (id, isEnabled) =>
    set((state) => {
      const current = state.installed[id];
      if (!current) return state;

      return { installed: { ...state.installed, [id]: { ...current, isEnabled } } };
    }),

  toggleEnabled: (id) => {
    const current = get().installed[id];
    if (!current) return;
    get().setEnabled(id, !current.isEnabled);
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.plugins, Object.values(get().installed));
  },

  hydrate: async () => {
    const saved = await storageService.get<InstalledPlugin[]>(STORAGE_KEYS.plugins, []);

    // Um plugin guardado que já não exista no catálogo é descartado — acontece
    // quando um plugin sai da loja, e sem isto ficaria instalado e invisível.
    const known = new Set(PLUGIN_CATALOG.map((entry) => entry.id));
    const installed = builtInState();

    for (const entry of saved) {
      if (!known.has(entry.id)) continue;
      installed[entry.id] = entry;
    }

    set({ installed });
  },
}));

export function selectIsInstalled(state: PluginState, id: string): boolean {
  return state.installed[id] !== undefined;
}

/** Quantos estão instalados além dos que vêm com o sistema. */
export function selectInstalledCount(state: PluginState): number {
  return Object.keys(state.installed).length;
}
