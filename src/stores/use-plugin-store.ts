import { create } from 'zustand';

import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { pluginService } from '@/services/plugin-service';

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
 *
 * A lógica de catálogo e persistência vive em `PluginService`
 * (`services/plugin-service.ts`) — esta store é só a camada reativa:
 * estado + eventos + auditoria.
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

export const usePluginStore = create<PluginState>((set, get) => ({
  installed: pluginService.getBuiltInState(),
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
      // Os do sistema não se removem: a regra vive aqui (não no serviço) para
      // ficar ao lado do resto das validações de estado visíveis à interface.
      if (pluginService.isBuiltIn(id)) return state;

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
    await pluginService.save(get().installed, get().deniedPermissions);
  },

  hydrate: async () => {
    const { installed, deniedPermissions } = await pluginService.load();
    set({ installed, deniedPermissions });
  },
}));

/**
 * Se uma permissão de um plugin foi recusada (Parte 14 §Permissões por
 * plugin). Nenhum plugin executa código próprio ainda, mas duas das
 * peças que o catálogo descreve como "plugins" — o assistente
 * (`core-assistant`) e o motor de automações (`automations`) — são
 * funcionalidades a sério do próprio sistema. Recusar aqui já impede
 * chamadas de verdade: ver `ai-service.ts` (rede) e `App.tsx` (notificar).
 */
export function selectPermissionDenied(
  state: PluginState,
  pluginId: string,
  permission: string,
): boolean {
  return (state.deniedPermissions[pluginId] ?? []).includes(permission);
}

