import { beforeEach, describe, expect, it } from 'vitest';

import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { PluginService } from '@/services/plugin-service';
import type { InstalledPlugin } from '@/stores/use-plugin-store';

const BUILT_IN = PLUGIN_CATALOG.filter((entry) => entry.isBuiltIn);
const REMOVABLE = PLUGIN_CATALOG.filter((entry) => !entry.isBuiltIn);

beforeEach(() => {
  localStorage.clear();
});

describe('PluginService', () => {
  const service = new PluginService(storageService);

  describe('getBuiltInState', () => {
    it('devolve só os que vêm com o sistema', () => {
      const state = service.getBuiltInState();

      for (const entry of BUILT_IN) {
        expect(state[entry.id]).toBeDefined();
        expect(state[entry.id]?.isEnabled).toBe(true);
        expect(state[entry.id]?.installedAt).toBe(0);
      }

      for (const entry of REMOVABLE) {
        expect(state[entry.id]).toBeUndefined();
      }
    });

    it('todos os built-in têm isEnabled a true', () => {
      const state = service.getBuiltInState();
      for (const entry of BUILT_IN) {
        expect(state[entry.id]?.isEnabled).toBe(true);
      }
    });
  });

  describe('existsInCatalog', () => {
    it('devolve true para um plugin do catálogo', () => {
      expect(service.existsInCatalog(BUILT_IN[0]!.id)).toBe(true);
      expect(service.existsInCatalog(REMOVABLE[0]!.id)).toBe(true);
    });

    it('devolve false para um id que não existe', () => {
      expect(service.existsInCatalog('plugin-que-nao-existe')).toBe(false);
    });
  });

  describe('isBuiltIn', () => {
    it('devolve true para os do sistema', () => {
      for (const entry of BUILT_IN) {
        expect(service.isBuiltIn(entry.id)).toBe(true);
      }
    });

    it('devolve false para os removíveis', () => {
      for (const entry of REMOVABLE.slice(0, 3)) {
        expect(service.isBuiltIn(entry.id)).toBe(false);
      }
    });

    it('devolve false para um id que não existe', () => {
      expect(service.isBuiltIn('plugin-que-nao-existe')).toBe(false);
    });
  });

  describe('save e load', () => {
    it('carrega os built-in mesmo com armazenamento vazio', async () => {
      const { installed } = await service.load();

      for (const entry of BUILT_IN) {
        expect(installed[entry.id]).toBeDefined();
      }
    });

    it('junta removíveis aos built-in ao carregar', async () => {
      const id = REMOVABLE[0]!.id;
      const saved: Record<string, InstalledPlugin> = {
        ...service.getBuiltInState(),
        [id]: { id, installedAt: 123, isEnabled: false },
      };

      await service.save(saved, {});
      const { installed } = await service.load();

      expect(installed[id]?.isEnabled).toBe(false);
      expect(installed[id]?.installedAt).toBe(123);
    });

    it('descarta um plugin que já não está no catálogo', async () => {
      const ghost: InstalledPlugin[] = [
        { id: 'plugin-que-ja-nao-existe', installedAt: 1, isEnabled: true },
      ];
      await storageService.set(STORAGE_KEYS.plugins, ghost);

      const { installed } = await service.load();

      expect(installed['plugin-que-ja-nao-existe']).toBeUndefined();
    });

    it('repõe os do sistema mesmo que o ficheiro não os inclua', async () => {
      await storageService.set(STORAGE_KEYS.plugins, []);

      const { installed } = await service.load();

      for (const entry of BUILT_IN) {
        expect(installed[entry.id]).toBeDefined();
      }
    });

    it('lê o formato antigo (só a lista)', async () => {
      const id = REMOVABLE[0]!.id;
      const saved: InstalledPlugin[] = [
        { id, installedAt: 999, isEnabled: true },
      ];
      await storageService.set(STORAGE_KEYS.plugins, saved);

      const { installed, deniedPermissions } = await service.load();

      expect(installed[id]?.installedAt).toBe(999);
      expect(deniedPermissions).toEqual({});
    });

    it('lê o formato novo (installed + deniedPermissions)', async () => {
      const id = REMOVABLE[0]!.id;
      await storageService.set(STORAGE_KEYS.plugins, {
        installed: [{ id, installedAt: 456, isEnabled: true }],
        deniedPermissions: { [id]: ['notifications'] },
      });

      const { installed, deniedPermissions } = await service.load();

      expect(installed[id]?.installedAt).toBe(456);
      expect(deniedPermissions[id]).toContain('notifications');
    });

    it('persiste e recarrega sem perder permissões recusadas', async () => {
      const id = REMOVABLE[0]!.id;
      const installed: Record<string, InstalledPlugin> = {
        ...service.getBuiltInState(),
        [id]: { id, installedAt: 1, isEnabled: true },
      };
      const deniedPermissions = { [id]: ['network', 'notifications'] as readonly string[] };

      await service.save(installed, deniedPermissions);
      const result = await service.load();

      expect(result.installed[id]).toBeDefined();
      expect(result.deniedPermissions[id]).toEqual(['network', 'notifications']);
    });
  });
});
