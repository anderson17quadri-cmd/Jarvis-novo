import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearRevokedKeys,
  generateSigningKeyPair,
  getRevokedKeys,
  isKeyRevoked,
  revokeKey,
  signPlugin,
  unrevokeKey,
  verifyPluginSignature,
  verifySignedPluginPackage,
  getSignatureStatus,
} from '@/plugins/signature';
import type { PluginManifest } from '@/plugins/plugin';

/**
 * Testes reais de assinatura de plugins — Ed25519 via SubtleCrypto.
 *
 * Cada teste gera o seu próprio par de chaves, como pedido — nunca chaves
 * fixas escritas no código. Os manifestos de teste são mínimos mas completos,
 * com todos os campos obrigatórios do `PluginManifest`.
 *
 * Confirmado a sério (12/08/2026): Ed25519 funciona no Node 24.19 e no
 * WebView2 do Windows 11. O teste da corrupção de assinatura prova que a
 * verificação não está a aceitar tudo — só assinaturas matematicamente
 * corretas passam.
 */

// ─── Manifesto e código de teste mínimos mas reais ───────────────────────────

function testManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id: 'plugin-teste',
    name: 'Plugin de teste',
    version: '1.0.0',
    description: 'Um plugin para testar assinaturas.',
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
    },
    platforms: ['desktop'],
    ...overrides,
  };
}

/** Código mínimo mas real — a assinatura cobre `manifest` + este `code`. */
const CODE =
  'window.addEventListener("message", (e) => { if (e.data?.type === "core.run") { parent.postMessage({ type: "core.notify", requestId: "t", payload: { titulo: "OK", corpo: "Teste" }}, "*"); } });';

// ─── Geração e exportação/importação de chaves ───────────────────────────────

describe('generateSigningKeyPair', () => {
  it('gera um par de chaves Ed25519 — pública 32 bytes, privada PKCS#8', async () => {
    const pair = await generateSigningKeyPair();

    // Chave pública raw: 32 bytes → 44 caracteres em base64.
    expect(pair.publicKey).toBeTypeOf('string');
    expect(pair.publicKey.length).toBeGreaterThanOrEqual(40);

    // Chave privada PKCS#8: ~48 bytes → ~64 caracteres em base64.
    expect(pair.privateKey).toBeTypeOf('string');
    expect(pair.privateKey.length).toBeGreaterThanOrEqual(60);
  });

  it('cada chamada gera um par diferente — não determinístico', async () => {
    const a = await generateSigningKeyPair();
    const b = await generateSigningKeyPair();

    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});

// ─── Assinar e verificar (round-trip feliz) ─────────────────────────────────

describe('signPlugin + verifyPluginSignature', () => {
  it('assina e verifica com sucesso — round-trip completo', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const signature = await signPlugin(manifest, CODE, pair.privateKey);
    const valid = await verifyPluginSignature(manifest, CODE, signature, pair.publicKey);

    expect(valid).toBe(true);
  });

  it('a mesma assinatura verifica contra a mesma chave pública — idempotente', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Verificar várias vezes — tem de dar sempre o mesmo resultado.
    for (let i = 0; i < 5; i++) {
      expect(await verifyPluginSignature(manifest, CODE, signature, pair.publicKey)).toBe(true);
    }
  });

  it('manifestos diferentes produzem assinaturas diferentes', async () => {
    const pair = await generateSigningKeyPair();
    const a = testManifest({ name: 'Plugin A' });
    const b = testManifest({ name: 'Plugin B' });

    const sigA = await signPlugin(a, CODE, pair.privateKey);
    const sigB = await signPlugin(b, CODE, pair.privateKey);

    expect(sigA).not.toBe(sigB);
  });

  it('código diferente produz assinaturas diferentes', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const sigA = await signPlugin(manifest, 'console.log("a");', pair.privateKey);
    const sigB = await signPlugin(manifest, 'console.log("b");', pair.privateKey);

    expect(sigA).not.toBe(sigB);
  });
});

// ─── Assinatura canónica (mesmo objeto = mesma assinatura) ──────────────────

describe('canonicalManifestBytes — ordenação canónica', () => {
  it('o mesmo manifesto e código produzem sempre a mesma assinatura', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const sig1 = await signPlugin(manifest, CODE, pair.privateKey);
    const sig2 = await signPlugin(manifest, CODE, pair.privateKey);

    expect(sig1).toBe(sig2);
  });

  it('a ordem das chaves de permissions não afeta a assinatura', async () => {
    const pair = await generateSigningKeyPair();

    // Construir com as permissões fora de ordem alfabética.
    const manifest: PluginManifest = {
      id: 'plugin-teste',
      name: 'Teste',
      version: '1.0.0',
      description: '',
      author: '',
      permissions: {
        // Ordem não alfabética de propósito.
        notifications: true,
        windows: false,
        filesystem: false,
        shell: false,
        commands: false,
        events: false,
        storage: false,
        shortcuts: false,
        widgets: false,
        menus: false,
        settings: false,
        services: false,
        panels: false,
        network: false,
        systemMetrics: false,
      },
      platforms: ['desktop'],
    };

    const sig = await signPlugin(manifest, CODE, pair.privateKey);
    const valid = await verifyPluginSignature(manifest, CODE, sig, pair.publicKey);

    expect(valid).toBe(true);
  });
});

// ─── Cenários de falha ──────────────────────────────────────────────────────

describe('assinatura inválida / corrompida', () => {
  it('assinatura corrompida: recusada', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Corromper um byte da assinatura.
    const raw = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    raw[10] = (raw[10] ?? 0) ^ 0xff;
    const corrupt = btoa(String.fromCharCode(...raw));

    const valid = await verifyPluginSignature(manifest, CODE, corrupt, pair.publicKey);
    expect(valid).toBe(false);
  });

  it('chave pública errada (de outro par): recusada', async () => {
    const pair1 = await generateSigningKeyPair();
    const pair2 = await generateSigningKeyPair();
    const manifest = testManifest();

    const signature = await signPlugin(manifest, CODE, pair1.privateKey);
    const valid = await verifyPluginSignature(manifest, CODE, signature, pair2.publicKey);

    expect(valid).toBe(false);
  });

  it('manifesto alterado depois de assinar: recusado', async () => {
    const pair = await generateSigningKeyPair();
    const original = testManifest({ name: 'Original' });
    const signature = await signPlugin(original, CODE, pair.privateKey);

    // Alterar depois de assinar.
    const altered = testManifest({ name: 'Alterado' });
    const valid = await verifyPluginSignature(altered, CODE, signature, pair.publicKey);

    expect(valid).toBe(false);
  });

  it('código alterado depois de assinar: recusado (a assinatura cobre o código)', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Trocar uma chamada do código por outra — o hash muda e a assinatura
    // tem de deixar de bater. É o buraco que esta correção fecha: antes, o
    // código podia ser trocado por outro JavaScript qualquer e a verificação
    // continuava a dizer "assinado e verificado".
    const alteredCode = CODE.replace('core.notify', 'core.fs.write');
    const valid = await verifyPluginSignature(manifest, alteredCode, signature, pair.publicKey);

    expect(valid).toBe(false);
  });

  it('campo __proto__ acrescentado ao manifesto: recusado (a assinatura cobre o manifesto inteiro)', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // `__proto__` acrescentado a um manifesto assinado tem de invalidar a
    // assinatura — é um campo a mais, e a assinatura cobre o manifesto inteiro.
    // `Object.defineProperty` cria uma propriedade *própria* chamada
    // `__proto__`; o atalho `{ ['__proto__']: ... }` mexeria no protótipo do
    // objeto e não criava campo nenhum.
    const withProto = { ...manifest };
    Object.defineProperty(withProto, '__proto__', {
      value: { injected: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const valid = await verifyPluginSignature(withProto, CODE, signature, pair.publicKey);

    expect(valid).toBe(false);
  });

  it('chave pública com formato inválido (base64 de lixo): recusada, não rebenta', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const valid = await verifyPluginSignature(manifest, CODE, signature, '!!!isto-não-é-base64!!!');

    expect(valid).toBe(false);
  });

  it('assinatura com tamanho errado (não são 64 bytes): recusada, não rebenta', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const valid = await verifyPluginSignature(
      manifest,
      CODE,
      btoa('curta'), // 5 bytes, não 64
      pair.publicKey,
    );

    expect(valid).toBe(false);
  });
});

// ─── verifySignedPluginPackage (verificação completa) ────────────────────────

describe('verifySignedPluginPackage', () => {
  it('assinatura válida + chave não revogada → assinado-valido', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinado-valido');
  });

  it('assinatura inválida → assinatura-invalida', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Corromper.
    const raw = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    raw[0] = (raw[0] ?? 0) ^ 0xff;
    const corrupt = btoa(String.fromCharCode(...raw));

    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature: corrupt,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinatura-invalida');
  });

  it('código adulterado → assinatura-invalida', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE.replace('core.notify', 'core.fs.write'),
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinatura-invalida');
  });

  it('assinatura válida + chave revogada → chave-revogada', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Revogar a chave primeiro.
    revokeKey(pair.publicKey, 'Chave de teste, comprometida.');

    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('chave-revogada');
  });
});

// ─── getSignatureStatus (com e sem assinatura) ──────────────────────────────

describe('getSignatureStatus', () => {
  it('entrada sem assinatura → sem-assinatura', async () => {
    const manifest = testManifest();

    const status = await getSignatureStatus({ manifest });

    expect(status).toBe('sem-assinatura');
  });

  it('entrada sem signerPublicKey (mas com signature) → sem-assinatura', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const status = await getSignatureStatus({ manifest, code: CODE, signature });

    expect(status).toBe('sem-assinatura');
  });

  it('entrada com assinatura válida → assinado-valido', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    const status = await getSignatureStatus({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinado-valido');
  });

  it('entrada com assinatura inválida → assinatura-invalida', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const status = await getSignatureStatus({
      manifest,
      code: CODE,
      signature: 'ZmFrZQ==', // base64 de "fake"
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinatura-invalida');
  });

  it('entrada com assinatura mas sem código → assinatura-invalida (não se prova o código)', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Assinatura e chave presentes, mas sem `code` para a verificar — aceitar
    // seria voltar a confiar só no manifesto, o buraco que esta correção fecha.
    const status = await getSignatureStatus({
      manifest,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinatura-invalida');
  });
});

// ─── Lista de revogação ─────────────────────────────────────────────────────

describe('revogação de chaves', () => {
  beforeEach(() => {
    clearRevokedKeys();
  });

  afterEach(() => {
    clearRevokedKeys();
  });

  it('lista começa vazia', () => {
    expect(getRevokedKeys()).toHaveLength(0);
  });

  it('revogar uma chave: aparece na lista', () => {
    revokeKey('chave-publica-exemplo', 'Comprometida em 2026-08-12.');

    const list = getRevokedKeys();
    expect(list).toHaveLength(1);
    expect(list[0]?.publicKey).toBe('chave-publica-exemplo');
    expect(list[0]?.reason).toContain('2026-08-12');
  });

  it('isKeyRevoked confirma que a chave está revogada', () => {
    revokeKey('chave-x', 'motivo');

    expect(isKeyRevoked('chave-x')).toBe(true);
    expect(isKeyRevoked('chave-y')).toBe(false);
  });

  it('revogar a mesma chave duas vezes não duplica — idempotente', () => {
    revokeKey('chave-unica', 'primeira razão');
    revokeKey('chave-unica', 'segunda razão');

    const list = getRevokedKeys();
    expect(list).toHaveLength(1);
    // A razão mais recente prevalece.
    expect(list[0]?.reason).toBe('segunda razão');
  });

  it('unrevokeKey remove a chave da lista', () => {
    revokeKey('chave-temporaria', 'teste');
    expect(isKeyRevoked('chave-temporaria')).toBe(true);

    unrevokeKey('chave-temporaria');
    expect(isKeyRevoked('chave-temporaria')).toBe(false);
  });

  it('revogar não afeta a verificação matemática — só a camada de política', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // A assinatura é matematicamente válida, mesmo com chave revogada.
    const valid = await verifyPluginSignature(manifest, CODE, signature, pair.publicKey);
    expect(valid).toBe(true);

    // Mas a verificação completa (política) bloqueia.
    revokeKey(pair.publicKey, 'teste');
    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });
    expect(status).toBe('chave-revogada');
  });

  it('várias chaves revogadas ao mesmo tempo', () => {
    revokeKey('a', 'r1');
    revokeKey('b', 'r2');
    revokeKey('c', 'r3');

    expect(getRevokedKeys()).toHaveLength(3);
    expect(isKeyRevoked('a')).toBe(true);
    expect(isKeyRevoked('b')).toBe(true);
    expect(isKeyRevoked('c')).toBe(true);
  });
});

// ─── Integração: fluxo completo de instalação com assinatura ────────────────

describe('fluxo de instalação com assinatura (integração)', () => {
  beforeEach(() => {
    clearRevokedKeys();
    localStorage.clear();
  });

  afterEach(() => {
    clearRevokedKeys();
    localStorage.clear();
  });

  it('plugin do catálogo sem assinatura: aceite (confia-se na origem)', async () => {
    const { verifyAndInstallPlugin } = await import('@/stores/use-plugin-store');

    const result = await verifyAndInstallPlugin({
      id: 'ola-notificacao',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('assinado-valido');
  });

  it('plugin do catálogo com assinatura válida: aceite', async () => {
    const pair = await generateSigningKeyPair();
    const { toManifest, PLUGIN_CATALOG } = await import('@/apps/plugin-manager/plugin-catalog');
    const entry = PLUGIN_CATALOG.find((e) => e.id === 'ola-notificacao');
    if (!entry) throw new Error('Plugin de teste não encontrado no catálogo');

    const manifest = toManifest(entry);
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // A assinatura cobre manifest + código. Verificamos a função de nível
    // baixo — o catálogo real não tem entradas assinadas.
    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinado-valido');
  });

  it('plugin com chave revogada: recusado mesmo com assinatura matematicamente correta', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signPlugin(manifest, CODE, pair.privateKey);

    // Revogar.
    revokeKey(pair.publicKey, 'Chave de teste comprometida.');

    const status = await verifySignedPluginPackage({
      manifest,
      code: CODE,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('chave-revogada');
  });
});

// ─── Vários manifestos, mesmo autor ─────────────────────────────────────────

describe('vários plugins do mesmo autor', () => {
  it('a mesma chave assina plugins diferentes, ambos verificam', async () => {
    const pair = await generateSigningKeyPair();

    const pluginA = testManifest({ id: 'plugin-a', name: 'Plugin A' });
    const pluginB = testManifest({ id: 'plugin-b', name: 'Plugin B' });

    const sigA = await signPlugin(pluginA, CODE, pair.privateKey);
    const sigB = await signPlugin(pluginB, CODE, pair.privateKey);

    expect(await verifyPluginSignature(pluginA, CODE, sigA, pair.publicKey)).toBe(true);
    expect(await verifyPluginSignature(pluginB, CODE, sigB, pair.publicKey)).toBe(true);

    // A assinatura de A não verifica em B, e vice-versa.
    expect(await verifyPluginSignature(pluginB, CODE, sigA, pair.publicKey)).toBe(false);
    expect(await verifyPluginSignature(pluginA, CODE, sigB, pair.publicKey)).toBe(false);
  });
});
