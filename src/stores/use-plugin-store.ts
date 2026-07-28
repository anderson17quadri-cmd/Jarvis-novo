import { create } from 'zustand';

import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
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
  /**
   * Permissões recusadas, por plugin (Parte 14).
   *
   * Guardam-se as recusas e não as concessões: um plugin instalado começa com
   * o que declarou no manifesto, e a lista só cresce quando alguém tira algo.
   * Assim uma permissão nova numa versão futura não fica silenciosamente
   * concedida por omissão do ficheiro guardado.
   */
  readonly deniedPermissions: Readonly<Record<string, readonly string[]>>;

  install: (id: string) => void;
  setPermission: (pluginId: string, permission: string, allow: boolean) => void;
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
  deniedPermissions: {},

  install: (id) =>
    set((state) => {
      if (state.installed[id]) return state;

      eventBus.emit('plugin:instalado', { pluginId: id });
      logService.audit(`Instalar o plugin ${id}`, 'executado');

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

      eventBus.emit('plugin:removido', { pluginId: id });
      logService.audit(`Remover o plugin ${id}`, 'executado');
      return { installed: rest };
    }),

  setPermission: (pluginId, permission, allow) =>
    set((state) => {
      const current = state.deniedPermissions[pluginId] ?? [];
      const next = allow
        ? current.filter((entry) => entry !== permission)
        : [...new Set([...current, permission])];

      logService.audit(
        `Permissão "${permission}" de ${pluginId}`,
        allow ? 'permitido' : 'recusado',
      );

      return { deniedPermissions: { ...state.deniedPermissions, [pluginId]: next } };
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
    await storageService.set(STORAGE_KEYS.plugins, {
      installed: Object.values(get().installed),
      deniedPermissions: get().deniedPermissions,
    });
  },

  hydrate: async () => {
    const raw = await storageService.get<
      InstalledPlugin[] | { installed: InstalledPlugin[]; deniedPermissions: Record<string, string[]> }
    >(STORAGE_KEYS.plugins, []);

    // O formato antigo era só a lista. Ler os dois evita que quem já tinha
    // plugins instalados os perca ao atualizar.
    const saved = Array.isArray(raw) ? raw : raw.installed;
    const deniedPermissions = Array.isArray(raw) ? {} : raw.deniedPermissions;

    // Um plugin guardado que já não exista no catálogo é descartado — acontece
    // quando um plugin sai da loja, e sem isto ficaria instalado e invisível.
    const known = new Set(PLUGIN_CATALOG.map((entry) => entry.id));
    const installed = builtInState();

    for (const entry of saved) {
      if (!known.has(entry.id)) continue;
      installed[entry.id] = entry;
    }

    set({ installed, deniedPermissions });
  },
}));

export function selectIsInstalled(state: PluginState, id: string): boolean {
  return state.installed[id] !== undefined;
}

/** Quantos estão instalados além dos que vêm com o sistema. */
export function selectInstalledCount(state: PluginState): number {
  return Object.keys(state.installed).length;
}
