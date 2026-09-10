import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { storageService, STORAGE_KEYS, type StorageService } from './storage-service';
import type { InstalledPlugin } from '@/stores/use-plugin-store';

/**
 * Serviço de plugins — puro, sem React nem Zustand.
 *
 * O que faz: ler o catálogo, validar o que está ou não no catálogo, e falar
 * com o armazenamento persistente. O que **não** faz: estado reativo, eventos
 * no barramento, registo de auditoria. Esses vivem na store (`usePluginStore`),
 * que é a camada fina por cima deste serviço.
 */
export class PluginService {
  constructor(private readonly storage: StorageService = storageService) {}

  /**
   * Plugins que vêm com o sistema.
   *
   * Já instalados, ativos, com `installedAt: 0` — não se removem nem
   * desativam pela interface normal.
   */
  getBuiltInState(): Record<string, InstalledPlugin> {
    const state: Record<string, InstalledPlugin> = {};

    for (const entry of PLUGIN_CATALOG) {
      if (!entry.isBuiltIn) continue;
      state[entry.id] = { id: entry.id, installedAt: 0, isEnabled: true };
    }

    return state;
  }

  /** `true` se o plugin existe no catálogo (esteja ou não instalado). */
  existsInCatalog(id: string): boolean {
    return PLUGIN_CATALOG.some((entry) => entry.id === id);
  }

  /** `true` para os que vêm com o sistema e não se removem. */
  isBuiltIn(id: string): boolean {
    return PLUGIN_CATALOG.some((entry) => entry.id === id && entry.isBuiltIn);
  }

  /**
   * Lê o estado guardado e junta-o com os do sistema.
   *
   * Um plugin guardado que já não exista no catálogo **é mantido** — são os
   * plugins instalados de ficheiro, que sobrevivem a fechar e reabrir a
   * aplicação. Os do sistema são sempre repostos, mesmo que o ficheiro não os
   * inclua.
   */
  async load(): Promise<{
    installed: Record<string, InstalledPlugin>;
    deniedPermissions: Record<string, readonly string[]>;
  }> {
    const raw = await this.storage.get<
      InstalledPlugin[] | { installed: InstalledPlugin[]; deniedPermissions: Record<string, string[]> }
    >(STORAGE_KEYS.plugins, []);

    // O formato antigo era só a lista. Ler os dois evita que quem já tinha
    // plugins instalados os perca ao atualizar.
    const saved = Array.isArray(raw) ? raw : Array.isArray(raw.installed) ? raw.installed : [];
    const deniedPermissions = Array.isArray(raw) ? {} : raw.deniedPermissions ?? {};

    const installed = this.getBuiltInState();

    for (const entry of saved) {
      installed[entry.id] = entry;
    }

    return { installed, deniedPermissions };
  }

  /** Persiste o estado completo. */
  async save(
    installed: Record<string, InstalledPlugin>,
    deniedPermissions: Record<string, readonly string[]>,
  ): Promise<void> {
    await this.storage.set(STORAGE_KEYS.plugins, {
      installed: Object.values(installed),
      deniedPermissions,
    });
  }
}

export const pluginService = new PluginService();
