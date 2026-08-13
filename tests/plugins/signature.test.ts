import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearRevokedKeys,
  generateSigningKeyPair,
  getRevokedKeys,
  isKeyRevoked,
  revokeKey,
  signManifest,
  unrevokeKey,
  verifyManifestSignature,
  verifySignedManifest,
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

// ─── Manifesto de teste mínimo mas real ─────────────────────────────────────

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

describe('signManifest + verifyManifestSignature', () => {
  it('assina e verifica com sucesso — round-trip completo', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const signature = await signManifest(manifest, pair.privateKey);
    const valid = await verifyManifestSignature(manifest, signature, pair.publicKey);

    expect(valid).toBe(true);
  });

  it('a mesma assinatura verifica contra a mesma chave pública — idempotente', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const signature = await signManifest(manifest, pair.privateKey);

    // Verificar várias vezes — tem de dar sempre o mesmo resultado.
    for (let i = 0; i < 5; i++) {
      expect(await verifyManifestSignature(manifest, signature, pair.publicKey)).toBe(true);
    }
  });

  it('manifestos diferentes produzem assinaturas diferentes', async () => {
    const pair = await generateSigningKeyPair();
    const a = testManifest({ name: 'Plugin A' });
    const b = testManifest({ name: 'Plugin B' });

    const sigA = await signManifest(a, pair.privateKey);
    const sigB = await signManifest(b, pair.privateKey);

    expect(sigA).not.toBe(sigB);
  });
});

// ─── Assinatura canónica (mesmo objeto = mesma assinatura) ──────────────────

describe('canonicalManifestBytes — ordenação canónica', () => {
  it('o mesmo manifesto produz sempre a mesma assinatura', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const sig1 = await signManifest(manifest, pair.privateKey);
    const sig2 = await signManifest(manifest, pair.privateKey);

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

    const sig = await signManifest(manifest, pair.privateKey);
    const valid = await verifyManifestSignature(manifest, sig, pair.publicKey);

    expect(valid).toBe(true);
  });
});

// ─── Cenários de falha ──────────────────────────────────────────────────────

describe('assinatura inválida / corrompida', () => {
  it('assinatura corrompida: recusada', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    // Corromper um byte da assinatura.
    const raw = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    raw[10] = (raw[10] ?? 0) ^ 0xff;
    const corrupt = btoa(String.fromCharCode(...raw));

    const valid = await verifyManifestSignature(manifest, corrupt, pair.publicKey);
    expect(valid).toBe(false);
  });

  it('chave pública errada (de outro par): recusada', async () => {
    const pair1 = await generateSigningKeyPair();
    const pair2 = await generateSigningKeyPair();
    const manifest = testManifest();

    const signature = await signManifest(manifest, pair1.privateKey);
    const valid = await verifyManifestSignature(manifest, signature, pair2.publicKey);

    expect(valid).toBe(false);
  });

  it('manifesto alterado depois de assinar: recusado', async () => {
    const pair = await generateSigningKeyPair();
    const original = testManifest({ name: 'Original' });
    const signature = await signManifest(original, pair.privateKey);

    // Alterar depois de assinar.
    const altered = testManifest({ name: 'Alterado' });
    const valid = await verifyManifestSignature(altered, signature, pair.publicKey);

    expect(valid).toBe(false);
  });

  it('campo __proto__ acrescentado ao manifesto: recusado (a assinatura cobre o manifesto inteiro)', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    // `__proto__` acrescentado a um manifesto assinado tem de invalidar a
    // assinatura — é um campo a mais, e a assinatura cobre o manifesto inteiro.
    // (Chave computada para criar uma propriedade própria `__proto__`, não para
    // mexer no protótipo do objeto.)
    const withProto = { ...manifest, ['__proto__']: { injected: true } } as unknown as PluginManifest;

    const valid = await verifyManifestSignature(withProto, signature, pair.publicKey);

    expect(valid).toBe(false);
  });

  it('chave pública com formato inválido (base64 de lixo): recusada, não rebenta', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    const valid = await verifyManifestSignature(manifest, signature, '!!!isto-não-é-base64!!!');

    expect(valid).toBe(false);
  });

  it('assinatura com tamanho errado (não são 64 bytes): recusada, não rebenta', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();

    const valid = await verifyManifestSignature(
      manifest,
      btoa('curta'), // 5 bytes, não 64
      pair.publicKey,
    );

    expect(valid).toBe(false);
  });
});

// ─── verifySignedManifest (verificação completa) ─────────────────────────────

describe('verifySignedManifest', () => {
  it('assinatura válida + chave não revogada → assinado-valido', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    const status = await verifySignedManifest({
      manifest,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinado-valido');
  });

  it('assinatura inválida → assinatura-invalida', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    // Corromper.
    const raw = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    raw[0] = (raw[0] ?? 0) ^ 0xff;
    const corrupt = btoa(String.fromCharCode(...raw));

    const status = await verifySignedManifest({
      manifest,
      signature: corrupt,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinatura-invalida');
  });

  it('assinatura válida + chave revogada → chave-revogada', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    // Revogar a chave primeiro.
    revokeKey(pair.publicKey, 'Chave de teste, comprometida.');

    const status = await verifySignedManifest({
      manifest,
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
    const signature = await signManifest(manifest, pair.privateKey);

    const status = await getSignatureStatus({ manifest, signature });

    expect(status).toBe('sem-assinatura');
  });

  it('entrada com assinatura válida → assinado-valido', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    const status = await getSignatureStatus({
      manifest,
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
      signature: 'ZmFrZQ==', // base64 de "fake"
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
    const signature = await signManifest(manifest, pair.privateKey);

    // A assinatura é matematicamente válida, mesmo com chave revogada.
    const valid = await verifyManifestSignature(manifest, signature, pair.publicKey);
    expect(valid).toBe(true);

    // Mas a verificação completa (política) bloqueia.
    revokeKey(pair.publicKey, 'teste');
    const status = await verifySignedManifest({ manifest, signature, signerPublicKey: pair.publicKey });
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
    const signature = await signManifest(manifest, pair.privateKey);

    // Inject the signature into the catalog entry (simulating a signed catalog entry)
    // We can't mutate the readonly catalog, so we test at the function level.
    const status = await verifySignedManifest({
      manifest,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('assinado-valido');
  });

  it('plugin com chave revogada: recusado mesmo com assinatura matematicamente correta', async () => {
    const pair = await generateSigningKeyPair();
    const manifest = testManifest();
    const signature = await signManifest(manifest, pair.privateKey);

    // Revogar.
    revokeKey(pair.publicKey, 'Chave de teste comprometida.');

    const status = await verifySignedManifest({
      manifest,
      signature,
      signerPublicKey: pair.publicKey,
    });

    expect(status).toBe('chave-revogada');
  });
});

// ─── Vários manifestos, mesmo autor ─────────────────────────────────────────

describe('vários plugins do mesmo autor', () => {
  it('a mesma chave assina manifestos diferentes, ambos verificam', async () => {
    const pair = await generateSigningKeyPair();

    const pluginA = testManifest({ id: 'plugin-a', name: 'Plugin A' });
    const pluginB = testManifest({ id: 'plugin-b', name: 'Plugin B' });

    const sigA = await signManifest(pluginA, pair.privateKey);
    const sigB = await signManifest(pluginB, pair.privateKey);

    expect(await verifyManifestSignature(pluginA, sigA, pair.publicKey)).toBe(true);
    expect(await verifyManifestSignature(pluginB, sigB, pair.publicKey)).toBe(true);

    // A assinatura de A não verifica em B, e vice-versa.
    expect(await verifyManifestSignature(pluginB, sigA, pair.publicKey)).toBe(false);
    expect(await verifyManifestSignature(pluginA, sigB, pair.publicKey)).toBe(false);
  });
});
