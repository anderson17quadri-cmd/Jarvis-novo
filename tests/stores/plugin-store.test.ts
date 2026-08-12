import { beforeEach, describe, expect, it } from 'vitest';

import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { usePluginStore, type InstalledPlugin } from '@/stores/use-plugin-store';

const BUILT_IN = PLUGIN_CATALOG.filter((entry) => entry.isBuiltIn);
const REMOVABLE = PLUGIN_CATALOG.filter((entry) => !entry.isBuiltIn);

beforeEach(async () => {
  localStorage.clear();
  await usePluginStore.getState().hydrate();
});

describe('estado dos plugins', () => {
  it('os do sistema já vêm instalados e ativos', () => {
    for (const entry of BUILT_IN) {
      expect(usePluginStore.getState().installed[entry.id]?.isEnabled).toBe(true);
    }
  });

  it('instalar duas vezes não muda a data de instalação', () => {
    const id = REMOVABLE[0]!.id;
    usePluginStore.getState().install(id);
    const first = usePluginStore.getState().installed[id]?.installedAt;

    usePluginStore.getState().install(id);
    expect(usePluginStore.getState().installed[id]?.installedAt).toBe(first);
  });

  it('um plugin do sistema não se remove, mesmo chamando a ação diretamente', () => {
    const id = BUILT_IN[0]!.id;
    usePluginStore.getState().uninstall(id);

    // A regra vive no store: um botão em falta não chegava para a garantir.
    expect(usePluginStore.getState().installed[id]).toBeDefined();
  });

  it('desativar não desinstala', () => {
    const id = REMOVABLE[0]!.id;
    usePluginStore.getState().install(id);
    usePluginStore.getState().toggleEnabled(id);

    expect(usePluginStore.getState().installed[id]).toBeDefined();
    expect(usePluginStore.getState().installed[id]?.isEnabled).toBe(false);
  });

  it('ativar o que não está instalado não cria nada', () => {
    const id = REMOVABLE[0]!.id;
    usePluginStore.getState().setEnabled(id, true);

    expect(usePluginStore.getState().installed[id]).toBeUndefined();
  });

  it('a escolha sobrevive a recarregar', async () => {
    const id = REMOVABLE[0]!.id;
    usePluginStore.getState().install(id);
    usePluginStore.getState().toggleEnabled(id);
    await usePluginStore.getState().persist();

    usePluginStore.setState({ installed: {} });
    await usePluginStore.getState().hydrate();

    expect(usePluginStore.getState().installed[id]?.isEnabled).toBe(false);
  });

  it('um plugin que não está no catálogo é mantido ao recarregar (plugin externo)', async () => {
    const saved: InstalledPlugin[] = [
      { id: 'plugin-que-ja-nao-existe', installedAt: 1, isEnabled: true },
    ];
    await storageService.set(STORAGE_KEYS.plugins, saved);

    await usePluginStore.getState().hydrate();

    // Plugins de ficheiro (externos) sobrevivem — não são descartados.
    expect(usePluginStore.getState().installed['plugin-que-ja-nao-existe']).toBeDefined();
  });

  it('recarregar repõe os do sistema mesmo que não estejam no que foi guardado', async () => {
    await storageService.set(STORAGE_KEYS.plugins, []);
    await usePluginStore.getState().hydrate();

    for (const entry of BUILT_IN) {
      expect(usePluginStore.getState().installed[entry.id]).toBeDefined();
    }
  });
});
