import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearDynamicRuntimes,
  getPluginRuntime,
  registerPluginRuntime,
  unregisterPluginRuntime,
} from '@/plugins/runtime/registry';
import {
  clearExternalPlugins,
  loadAllExternalPlugins,
  loadExternalPlugin,
  removeExternalPlugin,
  saveExternalPlugin,
} from '@/plugins/external-storage';
import {
  clearRevokedKeys,
  generateSigningKeyPair,
  signPlugin,
  verifySignedPluginPackage,
} from '@/plugins/signature';
import { validateManifest, validatePackage } from '@/plugins/install-from-file';
import type { PluginManifest, PluginPackage } from '@/plugins/plugin';

/**
 * Testes de instalação de plugin de ficheiro local.
 *
 * Testam o coração da lógica — validação de pacote, validação de manifesto,
 * verificação de assinatura para plugins externos, armazenamento externo e
 * registo dinâmico de runtime. Não testam o diálogo de ficheiro nem o comando
 * Rust (exigem Tauri a sério).
 *
 * Confirmado (12/08/2026): Ed25519 funciona no Node 24.19.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function testManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id: 'plugin-teste-ficheiro',
    name: 'Plugin de teste (ficheiro)',
    version: '1.0.0',
    description: 'Um plugin carregado de ficheiro para testar a instalação.',
    author: 'Testador',
    permissions: {
      filesystem: false,
      network: false,
      systemMetrics: false,
      notifications: true,
      shell: false,
      windows: false,
      commands: false,
      events: false,
      storage: false,
      shortcuts: false,
      widgets: false,
      menus: false,
      settings: false,
      services: false,
      panels: false,
      voice: false,
      memory: false,
    },
    platforms: ['desktop'],
    ...overrides,
  };
}

/** Código mínimo mas real — a assinatura cobre `manifest` + este `code`. */
const CODE =
  'window.addEventListener("message", (e) => { if (e.data?.type === "core.run") { parent.postMessage({ type: "core.notify", requestId: "t", payload: { titulo: "OK", corpo: "Teste" }}, "*"); } });';

/** Cria um pacote assinado e válido. */
async function signedPackage(
  overrides?: Partial<PluginManifest>,
): Promise<{ pkg: PluginPackage; privateKey: string }> {
  const pair = await generateSigningKeyPair();
  const manifest = testManifest(overrides);
  const signature = await signPlugin(manifest, CODE, pair.privateKey);

  const pkg: PluginPackage = {
    manifest,
    signature,
    signerPublicKey: pair.publicKey,
    signerName: 'Testador',
    code: CODE,
  };

  return { pkg, privateKey: pair.privateKey };
}

// ─── Limpeza ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearExternalPlugins();
  clearDynamicRuntimes();
  clearRevokedKeys();
  localStorage.clear();
});

afterEach(() => {
  clearExternalPlugins();
  clearDynamicRuntimes();
  clearRevokedKeys();
  localStorage.clear();
});

// ─── Armazenamento externo ────────────────────────────────────────────────────

describe('external storage (save/load/remove)', () => {
  it('saveExternalPlugin + loadExternalPlugin: round-trip', async () => {
    const { pkg } = await signedPackage();

    saveExternalPlugin(pkg);
    const loaded = loadExternalPlugin(pkg.manifest.id);

    expect(loaded).not.toBeUndefined();
    expect(loaded?.manifest.id).toBe(pkg.manifest.id);
    expect(loaded?.manifest.name).toBe(pkg.manifest.name);
    expect(loaded?.signature).toBe(pkg.signature);
    expect(loaded?.signerPublicKey).toBe(pkg.signerPublicKey);
    expect(loaded?.code).toBe(pkg.code);
  });

  it('loadExternalPlugin devolve undefined se não existir', () => {
    expect(loadExternalPlugin('inexistente')).toBeUndefined();
  });

  it('removeExternalPlugin apaga o pacote', async () => {
    const { pkg } = await signedPackage();

    saveExternalPlugin(pkg);
    expect(loadExternalPlugin(pkg.manifest.id)).not.toBeUndefined();

    removeExternalPlugin(pkg.manifest.id);
    expect(loadExternalPlugin(pkg.manifest.id)).toBeUndefined();
  });

  it('removeExternalPlugin é idempotente', () => {
    expect(() => removeExternalPlugin('nao-existe')).not.toThrow();
  });

  it('loadAllExternalPlugins devolve todos os pacotes guardados', async () => {
    const a = await signedPackage({ id: 'p1', name: 'P1' });
    const b = await signedPackage({ id: 'p2', name: 'P2' });

    saveExternalPlugin(a.pkg);
    saveExternalPlugin(b.pkg);

    const all = loadAllExternalPlugins();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.manifest.id).sort()).toEqual(['p1', 'p2']);
  });
});

// ─── Registo dinâmico de runtime ──────────────────────────────────────────────

describe('dynamic runtime registry', () => {
  it('registerPluginRuntime regista um runtime novo', () => {
    registerPluginRuntime('meu-plugin', { source: 'console.log("ok")', triggerLabel: 'Correr' });

    const runtime = getPluginRuntime('meu-plugin');
    expect(runtime).not.toBeUndefined();
    expect(runtime?.source).toBe('console.log("ok")');
    expect(runtime?.triggerLabel).toBe('Correr');
  });

  it('getPluginRuntime cai para built-in se não houver registo dinâmico', () => {
    const runtime = getPluginRuntime('ola-notificacao');
    expect(runtime).not.toBeUndefined();
    // O built-in tem source definida.
    expect(runtime?.source).toBeTypeOf('string');
    expect(runtime?.source.length).toBeGreaterThan(0);
  });

  it('getPluginRuntime devolve undefined para id inexistente', () => {
    expect(getPluginRuntime('id-que-nunca-existiu')).toBeUndefined();
  });

  it('unregisterPluginRuntime remove um registo dinâmico', () => {
    registerPluginRuntime('temp', { source: 'x', triggerLabel: 't' });
    expect(getPluginRuntime('temp')).not.toBeUndefined();

    unregisterPluginRuntime('temp');
    expect(getPluginRuntime('temp')).toBeUndefined();
  });

  it('unregisterPluginRuntime é idempotente', () => {
    expect(() => unregisterPluginRuntime('nunca-registado')).not.toThrow();
  });

  it('unregisterPluginRuntime não remove built-in', () => {
    unregisterPluginRuntime('ola-notificacao');
    // Continua a existir porque é built-in.
    expect(getPluginRuntime('ola-notificacao')).not.toBeUndefined();
  });

  it('registo dinâmico sobrescreve sem erro', () => {
    registerPluginRuntime('dinamico', { source: 'v1', triggerLabel: 'a' });
    registerPluginRuntime('dinamico', { source: 'v2', triggerLabel: 'b' });

    expect(getPluginRuntime('dinamico')?.source).toBe('v2');
  });
});

// ─── Validação do pacote ─────────────────────────────────────────────────────

describe('validatePackage (validação da forma do .jarvis-plugin)', () => {
  it('JSON inválido (não é objeto): recusado', () => {
    expect(() => validatePackage('isto não é um objeto')).toThrow('não é um JSON válido');
  });

  it('null: recusado', () => {
    expect(() => validatePackage(null)).toThrow('não é um JSON válido');
  });

  it('sem manifest: recusado', () => {
    expect(() => validatePackage({ signature: 'x', signerPublicKey: 'y', code: 'z' })).toThrow(
      'não tem o campo "manifest"',
    );
  });

  it('sem signature: recusado', () => {
    expect(() =>
      validatePackage({ manifest: {}, signerPublicKey: 'y', code: 'z' }),
    ).toThrow('não tem o campo "signature"');
  });

  it('signature vazia: recusado', () => {
    expect(() =>
      validatePackage({ manifest: {}, signature: '', signerPublicKey: 'y', code: 'z' }),
    ).toThrow('não tem o campo "signature"');
  });

  it('sem signerPublicKey: recusado', () => {
    expect(() =>
      validatePackage({ manifest: {}, signature: 'x', code: 'z' }),
    ).toThrow('não tem o campo "signerPublicKey"');
  });

  it('sem code: recusado', () => {
    expect(() =>
      validatePackage({ manifest: {}, signature: 'x', signerPublicKey: 'y' }),
    ).toThrow('não tem o campo "code"');
  });

  it('signerName inválido é ignorado, não recusa o pacote', () => {
    const pkg = validatePackage({
      manifest: {},
      signature: 'x',
      signerPublicKey: 'y',
      code: 'z',
      signerName: 42,
    });
    expect(pkg.signerName).toBeUndefined();
  });

  it('pacote válido: devolve os campos tal como vieram', () => {
    const manifest = testManifest();
    const pkg = validatePackage({
      manifest,
      signature: 'assinatura-base64',
      signerPublicKey: 'chave-base64',
      code: 'console.log(1)',
      signerName: 'Autor de Teste',
    });

    expect(pkg.manifest).toEqual(manifest);
    expect(pkg.signature).toBe('assinatura-base64');
    expect(pkg.signerPublicKey).toBe('chave-base64');
    expect(pkg.code).toBe('console.log(1)');
    expect(pkg.signerName).toBe('Autor de Teste');
  });
});

// ─── Validação do manifesto ──────────────────────────────────────────────────

describe('validateManifest (campos obrigatórios)', () => {
  it('manifesto válido: sem erro', () => {
    expect(validateManifest(testManifest())).toBeUndefined();
  });

  it('manifesto sem id: recusado', () => {
    expect(validateManifest(testManifest({ id: '' }))).toMatch('identificador');
  });

  it('manifesto com id fora do formato de slug: recusado', () => {
    // O id é o namespace de armazenamento (`plugins:<id>:<chave>`): um `:` lá
    // dentro deslocava a fronteira para cima dos dados de outro plugin.
    expect(validateManifest(testManifest({ id: 'notas:x' }))).toMatch('identificador');
    expect(validateManifest(testManifest({ id: 'com espaço' }))).toMatch('identificador');
    expect(validateManifest(testManifest({ id: 'MAIUSCULAS' }))).toMatch('identificador');
  });

  it('manifesto com id em formato de slug: aceite', () => {
    expect(validateManifest(testManifest({ id: 'guarda-preferencias' }))).toBeUndefined();
    expect(validateManifest(testManifest({ id: 'plugin_2' }))).toBeUndefined();
  });

  it('manifesto sem name: recusado', () => {
    expect(validateManifest(testManifest({ name: '' }))).toMatch('nome');
  });

  it('manifesto sem version: recusado', () => {
    expect(validateManifest(testManifest({ version: '' }))).toMatch('versão');
  });

  it('manifesto sem author: recusado', () => {
    expect(validateManifest(testManifest({ author: '' }))).toMatch('autor');
  });

  it('manifesto sem permissions: recusado', () => {
    const manifest: Record<string, unknown> = { ...testManifest() };
    delete manifest.permissions;
    expect(validateManifest(manifest as unknown as PluginManifest)).toMatch('permissões');
  });

  it('permissão com valor não booleano: recusado', () => {
    const manifest = testManifest();
    // `"false"` em string é verdade em JavaScript — recusa-se à instalação
    // em vez de deixar a fronteira de runtime tratar um valor desses como `true`.
    (manifest.permissions as unknown as Record<string, unknown>)['notifications'] = 'false';

    expect(validateManifest(manifest)).toMatch('true ou false');
  });
});

// ─── verifyAndInstallPlugin com isExternal ────────────────────────────────────

describe('verifyAndInstallPlugin — isExternal', () => {
  it('plugin externo sem assinatura: recusado', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');

    const result = await verifyAndInstallPlugin({
      id: 'externo-sem-assinatura',
      isExternal: true,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('sem-assinatura');
  });

  it('plugin externo com assinatura mas sem manifesto para verificar: recusado', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');

    // Assinatura e chave presentes, mas nenhum manifesto para as verificar —
    // instalar à mesma seria instalar um plugin externo sem nunca confirmar
    // que a assinatura é dele.
    const result = await verifyAndInstallPlugin({
      id: 'externo-sem-manifesto',
      signature: 'ZmFrZQ==',
      signerPublicKey: 'ZmFrZQ==',
      isExternal: true,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('assinatura-invalida');
  });

  it('plugin externo com assinatura e manifesto mas sem código: recusado', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'externo-sem-codigo' });
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Assinatura e manifesto presentes, mas sem o código que a assinatura cobre
    // — não se prova que o código está coberto, e recusa-se.
    const result = await verifyAndInstallPlugin({
      id: manifest.id,
      signature,
      signerPublicKey: pair.publicKey,
      isExternal: true,
      manifest,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('assinatura-invalida');
  });

  it('plugin externo com assinatura inválida: recusado', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'externo-assinatura-invalida' });

    const result = await verifyAndInstallPlugin({
      id: manifest.id,
      signature: 'c2lnbmF0dXJlLWludsOhbGlkYQ==', // base64 de lixo
      signerPublicKey: pair.publicKey,
      isExternal: true,
      manifest,
      code: CODE,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('assinatura-invalida');
  });

  it('plugin externo com chave revogada: recusado', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');
    const { revokeKey } = await import('@/plugins/signature');
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'externo-chave-revogada' });
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    revokeKey(pair.publicKey, 'Chave de teste comprometida.');

    const result = await verifyAndInstallPlugin({
      id: manifest.id,
      signature,
      signerPublicKey: pair.publicKey,
      isExternal: true,
      manifest,
      code: CODE,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('chave-revogada');
  });

  it('plugin externo com assinatura válida: aceite e instalado', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'externo-valido' });
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const result = await verifyAndInstallPlugin({
      id: manifest.id,
      signature,
      signerPublicKey: pair.publicKey,
      isExternal: true,
      manifest,
      code: CODE,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('assinado-valido');
  });

  it('plugin externo já instalado: recusado (não duplica)', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'externo-ja-instalado' });
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Primeira instalação: aceite.
    const r1 = await verifyAndInstallPlugin({
      id: manifest.id,
      signature,
      signerPublicKey: pair.publicKey,
      isExternal: true,
      manifest,
      code: CODE,
    });
    expect(r1.ok).toBe(true);

    // Segunda: recusada.
    const r2 = await verifyAndInstallPlugin({
      id: manifest.id,
      signature,
      signerPublicKey: pair.publicKey,
      isExternal: true,
      manifest,
      code: CODE,
    });
    expect(r2.ok).toBe(false);
  });
});

// ─── Fluxo completo (sem Tauri) ──────────────────────────────────────────────

describe('fluxo completo de instalação de ficheiro (integração)', () => {
  it('pacote assinado: guardado, runtime registado, aparece no catálogo externo', async () => {
    const { pkg } = await signedPackage({ id: 'fluxo-completo' });
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');
    const { getExternalCatalogEntries } = await import('@/apps/plugin-manager/plugin-catalog');

    // 1. Verificar assinatura e instalar.
    const result = await verifyAndInstallPlugin({
      id: pkg.manifest.id,
      signature: pkg.signature,
      signerPublicKey: pkg.signerPublicKey,
      isExternal: true,
      manifest: pkg.manifest,
      code: pkg.code,
    });
    expect(result.ok).toBe(true);

    // 2. Guardar o pacote.
    saveExternalPlugin(pkg);

    // 3. Registar o runtime.
    registerPluginRuntime(pkg.manifest.id, {
      source: pkg.code,
      triggerLabel: 'Executar',
    });

    // 4. Verificar que aparece no catálogo externo.
    const entries = getExternalCatalogEntries();
    const ourEntry = entries.find((e) => e.id === 'fluxo-completo');
    expect(ourEntry).not.toBeUndefined();
    expect(ourEntry?.name).toBe(pkg.manifest.name);
    expect(ourEntry?.signature).toBe(pkg.signature);
    expect(ourEntry?.signerPublicKey).toBe(pkg.signerPublicKey);
    expect(ourEntry?.signerName).toBe('Testador');

    // 5. Verificar que o runtime está registado.
    const runtime = getPluginRuntime('fluxo-completo');
    expect(runtime).not.toBeUndefined();
    expect(runtime?.source).toBe(pkg.code);

    // 6. Verificar que sobrevive a reload (simulado).
    const loaded = loadExternalPlugin('fluxo-completo');
    expect(loaded).not.toBeUndefined();
    expect(loaded?.manifest.id).toBe('fluxo-completo');
  });

  it('pacote removido: limpo do armazenamento e do runtime', async () => {
    const { pkg } = await signedPackage({ id: 'para-remover' });

    saveExternalPlugin(pkg);
    registerPluginRuntime(pkg.manifest.id, { source: pkg.code, triggerLabel: 'X' });

    // Remover.
    removeExternalPlugin(pkg.manifest.id);
    unregisterPluginRuntime(pkg.manifest.id);

    expect(loadExternalPlugin('para-remover')).toBeUndefined();
    expect(getPluginRuntime('para-remover')).toBeUndefined();
  });
});

// ─── A assinatura cobre o manifesto E o código ──────────────────────────────

describe('a assinatura cobre o manifesto e o código', () => {
  it('código diferente do assinado: assinatura inválida', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'codigo-adulterado' });
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Código trocado depois de assinar — o hash muda e a assinatura tem de
    // deixar de bater. É o buraco que esta correção fecha.
    const status = await verifySignedPluginPackage({
      manifest,
      code: 'console.log("versão 2 do código");',
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinatura-invalida');
  });

  it('código exato ao que foi assinado: assinatura válida', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest({ id: 'codigo-exato' });
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinado-valido');
  });
});
