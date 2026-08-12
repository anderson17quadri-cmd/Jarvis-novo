import { create } from 'zustand';

import { PLUGIN_CATALOG, toManifest } from '@/apps/plugin-manager/plugin-catalog';
import type { PluginManifest } from '@/plugins/plugin';
import { verifySignedManifest, type SignatureStatus } from '@/plugins/signature';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { pluginService } from '@/services/plugin-service';

/**
 * Estado da loja de plugins.
 *
 * Instalar acrescenta uma entrada a este mapa. A verificação de assinatura
 * (Ed25519 via SubtleCrypto) corre antes de instalar — ver `verifyAndInstallPlugin`.
 * Para plugins do catálogo local sem assinatura, a instalação é aceite
 * (confia-se na origem); para plugins externos, a assinatura é obrigatória.
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

/**
 * Instala um plugin depois de verificar a assinatura.
 *
 * Para plugins do catálogo: se tiverem assinatura, ela é verificada antes de
 * instalar. Sem assinatura, são aceites (confia-se no catálogo local).
 *
 * Para plugins externos (ficheiro local, marketplace): a assinatura é
 * obrigatória — `signature` e `signerPublicKey` têm de existir e ser válidos,
 * e a chave não pode estar revogada. O `manifest` passado por parâmetro é a
 * fonte de verdade para a verificação (não o catálogo, que não conhece este id).
 *
 * Devolve `{ ok: true }` se a instalação foi aceite, ou `{ ok: false, status }`
 * com o motivo da recusa.
 */
export async function verifyAndInstallPlugin(params: {
  readonly id: string;
  readonly signature?: string;
  readonly signerPublicKey?: string;
  /** `true` para plugins que vêm de fora do catálogo (ex.: ficheiro local). */
  readonly isExternal?: boolean;
  /**
   * Manifesto contra o qual verificar a assinatura.
   *
   * Para plugins do catálogo, usa-se o manifesto do catálogo. Para plugins
   * externos, o manifesto vem do próprio ficheiro e é passado aqui — sem ele,
   * a assinatura de um plugin externo não pode ser verificada.
   */
  readonly manifest?: PluginManifest;
}): Promise<{ ok: boolean; status: SignatureStatus }> {
  const store = usePluginStore.getState();

  // Já instalado — nada a fazer.
  if (store.installed[params.id]) {
    return { ok: false, status: 'assinado-valido' };
  }

  // Verificar assinatura.
  if (params.signature && params.signerPublicKey) {
    // Para plugins externos, o manifesto vem do ficheiro. Para plugins do
    // catálogo, usa-se o manifesto do catálogo.
    const manifest: PluginManifest | undefined =
      params.manifest ??
      (() => {
        const catalogEntry = PLUGIN_CATALOG.find((e) => e.id === params.id);
        return catalogEntry ? toManifest(catalogEntry) : undefined;
      })();

    if (manifest) {
      const status = await verifySignedManifest({
        manifest,
        signature: params.signature,
        signerPublicKey: params.signerPublicKey,
      });

      if (status !== 'assinado-valido') {
        logService.audit(`Assinatura de ${params.id}: ${status}`, 'recusado');
        return { ok: false, status };
      }
    }
  } else if (params.isExternal) {
    // Plugin externo sem assinatura — recusado.
    logService.audit(`Plugin externo ${params.id} sem assinatura`, 'recusado');
    return { ok: false, status: 'sem-assinatura' };
  }

  // Instalar.
  store.install(params.id);
  await store.persist();

  logService.audit(`Plugin ${params.id} instalado com assinatura verificada`, 'executado');
  return { ok: true, status: 'assinado-valido' };
}

