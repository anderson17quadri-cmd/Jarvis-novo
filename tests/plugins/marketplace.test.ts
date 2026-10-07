import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMarketplacePackage, loadMarketplace, prepareMarketplacePackage, rollbackMarketplacePlugin } from '@/plugins/marketplace';
import { generateSigningKeyPair, revokeKey, signPlugin } from '@/plugins/signature';
import { storageService } from '@/services/storage-service';
import { loadExternalPlugin } from '@/plugins/external-storage';
import { getPluginRuntime } from '@/plugins/runtime/registry';
import { usePluginStore } from '@/stores/use-plugin-store';
import type { PluginPackage } from '@/plugins/plugin';

beforeEach(async () => { vi.restoreAllMocks(); localStorage.clear(); await usePluginStore.getState().hydrate(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function packageFor(version: string, key?: Awaited<ReturnType<typeof generateSigningKeyPair>>): Promise<PluginPackage> {
  const signing = key ?? await generateSigningKeyPair();
  const manifest = { id: 'plugin-remoto', name: 'Remoto', version, description: '', author: 'Teste', permissions: {
    filesystem: false, network: false, systemMetrics: false, notifications: false, shell: false,
    windows: false, commands: false, events: false, storage: false, shortcuts: false, widgets: false,
    menus: false, settings: false, services: false, panels: false, voice: false, memory: false,
  }, platforms: ['desktop'] as const };
  const code = `console.log('${version}')`;
  return { manifest, code, signerPublicKey: signing.publicKey, signature: await signPlugin(manifest, code, signing.privateKey) };
}

describe('Marketplace assinado', () => {
  it('uma chave revogada não consegue instalar nem recuperar um pacote', async () => {
    const pkg = await packageFor('1');
    revokeKey(pkg.signerPublicKey, 'Revogação de teste');
    await expect(applyMarketplacePackage(pkg)).rejects.toThrow(/revogada/);
    expect(loadExternalPlugin(pkg.manifest.id)).toBeUndefined();
  });

  it('uma falha ao guardar a atualização repõe o pacote e runtime anteriores', async () => {
    const key = await generateSigningKeyPair();
    await applyMarketplacePackage(await packageFor('1', key));
    usePluginStore.getState().setEnabled('plugin-remoto', true);
    vi.spyOn(storageService, 'set').mockRejectedValue(new Error('Disco indisponível'));
    await expect(applyMarketplacePackage(await packageFor('2', key))).rejects.toThrow('Disco');
    expect(loadExternalPlugin('plugin-remoto')?.manifest.version).toBe('1');
    expect(getPluginRuntime('plugin-remoto')?.source).toContain("'1'");
    expect(usePluginStore.getState().installed['plugin-remoto']?.isEnabled).toBe(true);
  });
  it('recusa fontes locais e pacotes fora do repositório do índice', async () => {
    await expect(loadMarketplace('http://127.0.0.1/index.json')).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: 1, plugins: [{
      id: 'plugin-remoto', name: 'Remoto', version: '1', author: 'Teste',
      downloadUrl: 'https://raw.githubusercontent.com/outro/repo/main/plugin.jarvis-plugin', sha256: 'a'.repeat(64),
    }] }))));
    await expect(loadMarketplace('https://raw.githubusercontent.com/dono/repo/main/index.json')).rejects.toThrow(/repositório/);
  });

  it('recusa um pacote cujo hash não corresponde ao índice', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    await expect(prepareMarketplacePackage({ id: 'plugin-remoto', name: 'Remoto', version: '1', author: 'Teste',
      downloadUrl: 'https://raw.githubusercontent.com/dono/repo/main/a.jarvis-plugin', sha256: 'a'.repeat(64) },
    'https://raw.githubusercontent.com/dono/repo/main/index.json')).rejects.toThrow(/hash/);
    expect(loadExternalPlugin('plugin-remoto')).toBeUndefined();
  });

  it('atualiza código, conserva uma versão anterior e faz rollback assinado', async () => {
    const signing = await generateSigningKeyPair();
    await applyMarketplacePackage(await packageFor('1', signing));
    await applyMarketplacePackage(await packageFor('2', signing));
    expect(getPluginRuntime('plugin-remoto')?.source).toContain("'2'");
    expect(usePluginStore.getState().installed['plugin-remoto']?.isEnabled).toBe(false);
    await rollbackMarketplacePlugin('plugin-remoto');
    expect(loadExternalPlugin('plugin-remoto')?.manifest.version).toBe('1');
    expect(getPluginRuntime('plugin-remoto')?.source).toContain("'1'");
  });

  it('uma assinatura inválida ou outro editor não substitui a versão instalada', async () => {
    const first = await packageFor('1');
    await applyMarketplacePackage(first);
    await expect(applyMarketplacePackage({ ...first, code: 'alterado' })).rejects.toThrow(/assinatura/);
    await expect(applyMarketplacePackage(await packageFor('2'))).rejects.toThrow(/chave/);
    expect(loadExternalPlugin('plugin-remoto')?.manifest.version).toBe('1');
  });
});
