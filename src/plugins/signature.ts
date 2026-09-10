/**
 * Assinatura de plugins — Ed25519 via Web Crypto SubtleCrypto.
 *
 * Confirmado a sério (12/08/2026) no Node 24.19 e no WebView2 do Windows 11.
 * O algoritmo `Ed25519` está disponível no SubtleCrypto desde o Chrome 113
 * (Abril 2023) — o WebView2 do Windows 11 herda-o automaticamente.
 *
 *   - Chave pública:  32 bytes raw, codificada em base64.
 *   - Chave privada:  PKCS#8, codificada em base64.
 *   - Assinatura:     64 bytes raw, codificada em base64.
 *
 * A assinatura cobre o manifesto canónico **e** o código do plugin:
 * `canonicalManifestBytes(manifesto)` seguido do hash SHA-256 do `code` (UTF-8).
 * O manifesto usa `JSON.stringify(manifesto, Object.keys(manifesto).sort())` —
 * sem espaços extra, chaves sempre na mesma ordem. O código entra pelo hash em
 * vez de em bruto, para não haver ambiguidade de fronteira nem depender de como
 * `JSON.stringify` escapa caracteres entre engines.
 *
 * A lista de chaves revogadas vive em localStorage com uma chave fixa. É
 * simples e local, como pedido — nada de rede nem de CRL distribuída.
 */

import type { PluginManifest } from './plugin';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Estado da assinatura de um plugin, para a interface o mostrar. */
export type SignatureStatus =
  | 'assinado-valido'
  | 'sem-assinatura'
  | 'assinatura-invalida'
  | 'chave-revogada';

/** Um pacote assinado pelo autor — manifesto e código cobertos pela assinatura. */
export interface SignedPluginPackage {
  readonly manifest: PluginManifest;
  /** Código JavaScript do plugin, na forma exata em que é distribuído. */
  readonly code: string;
  /** Assinatura Ed25519 (64 bytes raw) codificada em base64. */
  readonly signature: string;
  /** Chave pública do signatário (32 bytes raw) codificada em base64. */
  readonly signerPublicKey: string;
}

/** Uma chave pública revogada. */
export interface RevocationEntry {
  readonly publicKey: string;
  readonly reason: string;
  readonly revokedAt: number;
}

// ─── Chave do localStorage ──────────────────────────────────────────────────

const REVOCATION_STORAGE_KEY = 'jarvis.plugin-revoked-keys';

// ─── Geração de chaves ──────────────────────────────────────────────────────

export interface GeneratedKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}

/**
 * Gera um par de chaves Ed25519 novo.
 *
 * A chave privada **nunca** deve ser distribuída — só a pública entra no
 * manifesto assinado. Esta função existe para o autor gerar o par, e para
 * os testes poderem criar pares efémeros sem chaves fixas no código.
 */
export async function generateSigningKeyPair(): Promise<GeneratedKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true, // extractable — precisamos de exportar
    ['sign', 'verify'],
  );

  const publicRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
  const privatePkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicRaw),
    privateKey: arrayBufferToBase64(privatePkcs8),
  };
}

// ─── Assinar ────────────────────────────────────────────────────────────────

/**
 * Assina um plugin (manifesto + código) com a chave privada dada.
 *
 * A assinatura cobre a representação canónica do manifesto seguida do hash
 * SHA-256 do código. Isto garante que o mesmo par (manifesto, código) produz
 * sempre a mesma assinatura, e que trocar o código por outro JavaScript
 * invalida a assinatura — o que a versão anterior (só manifesto) deixava
 * passar.
 */
export async function signPlugin(
  manifest: PluginManifest,
  code: string,
  privateKeyBase64: string,
): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyBase64);
  const payload = await signedPayloadBytes(manifest, code);
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, payload);
  return arrayBufferToBase64(signature);
}

// ─── Verificar ──────────────────────────────────────────────────────────────

/**
 * Verifica a assinatura de um plugin (manifesto + código) contra a chave
 * pública do signatário.
 *
 * Devolve `true` se a assinatura for matematicamente válida — **não** verifica
 * revogação. Usa `verifySignedPluginPackage` para a verificação completa.
 */
export async function verifyPluginSignature(
  manifest: PluginManifest,
  code: string,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<boolean> {
  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const payload = await signedPayloadBytes(manifest, code);
    const signature = base64ToArrayBuffer(signatureBase64);

    return await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, signature, payload);
  } catch {
    // Chave mal formatada, assinatura com tamanho errado — não é válida.
    return false;
  }
}

/**
 * Verificação completa: assinatura + lista de revogação.
 *
 * Só devolve `assinado-valido` se a assinatura (sobre manifesto + código) for
 * matematicamente correta **e** a chave não estiver na lista de revogação.
 */
export async function verifySignedPluginPackage(signed: SignedPluginPackage): Promise<SignatureStatus> {
  if (isKeyRevoked(signed.signerPublicKey)) {
    return 'chave-revogada';
  }

  const valid = await verifyPluginSignature(
    signed.manifest,
    signed.code,
    signed.signature,
    signed.signerPublicKey,
  );

  return valid ? 'assinado-valido' : 'assinatura-invalida';
}

/**
 * Determina o estado de assinatura de uma entrada do catálogo.
 *
 * Se a entrada não tiver assinatura, devolve `sem-assinatura` — os plugins do
 * catálogo local não são assinados (vêm com o sistema) e são aceites na mesma.
 * Para plugins externos (instalados de ficheiro), a ausência de assinatura
 * será tratada como bloqueante na função de instalação.
 */
export async function getSignatureStatus(entry: {
  readonly manifest: PluginManifest;
  readonly code?: string;
  readonly signature?: string;
  readonly signerPublicKey?: string;
}): Promise<SignatureStatus> {
  if (!entry.signature || !entry.signerPublicKey) {
    return 'sem-assinatura';
  }

  // Assinatura presente mas sem código para a verificar: não se prova que o
  // código está coberto, e aceitar seria voltar a confiar só no manifesto.
  if (typeof entry.code !== 'string') {
    return 'assinatura-invalida';
  }

  return verifySignedPluginPackage({
    manifest: entry.manifest,
    code: entry.code,
    signature: entry.signature,
    signerPublicKey: entry.signerPublicKey,
  });
}

// ─── Lista de revogação ─────────────────────────────────────────────────────

/** Lê a lista de chaves revogadas. */
export function getRevokedKeys(): readonly RevocationEntry[] {
  try {
    const raw = localStorage.getItem(REVOCATION_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RevocationEntry[];
  } catch {
    return [];
  }
}

/** Guarda a lista de chaves revogadas. */
function saveRevokedKeys(entries: readonly RevocationEntry[]): void {
  localStorage.setItem(REVOCATION_STORAGE_KEY, JSON.stringify(entries));
}

/** Verifica se uma chave pública está na lista de revogação. */
export function isKeyRevoked(publicKeyBase64: string): boolean {
  return getRevokedKeys().some((entry) => entry.publicKey === publicKeyBase64);
}

/** Adiciona uma chave à lista de revogação. Idempotente. */
export function revokeKey(publicKeyBase64: string, reason: string): void {
  const current = getRevokedKeys().filter((entry) => entry.publicKey !== publicKeyBase64);
  current.push({ publicKey: publicKeyBase64, reason, revokedAt: Date.now() });
  saveRevokedKeys(current);
}

/** Remove uma chave da lista de revogação. Idempotente. */
export function unrevokeKey(publicKeyBase64: string): void {
  const current = getRevokedKeys().filter((entry) => entry.publicKey !== publicKeyBase64);
  saveRevokedKeys(current);
}

/** Esvazia a lista de revogação — para testes. */
export function clearRevokedKeys(): void {
  localStorage.removeItem(REVOCATION_STORAGE_KEY);
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

/** Importa uma chave pública Ed25519 do formato raw (32 bytes) codificado em base64. */
async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
}

/** Importa uma chave privada Ed25519 do formato PKCS#8 codificado em base64. */
async function importPrivateKey(base64: string): Promise<CryptoKey> {
  const pkcs8 = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
}

/**
 * O que se assina: o manifesto canónico seguido do hash SHA-256 do código.
 *
 * O código entra pelo hash (32 bytes fixos) e não em bruto: assim não há
 * ambiguidade de fronteira entre as duas partes e a assinatura não depende de
 * como um `JSON.stringify` qualquer escaparia o código — o hash é calculado
 * sobre os bytes UTF-8 do `code` tal como ele é distribuído.
 */
async function signedPayloadBytes(manifest: PluginManifest, code: string): Promise<ArrayBuffer> {
  const manifestBytes = new Uint8Array(canonicalManifestBytes(manifest));
  const codeHash = await sha256(new TextEncoder().encode(code));
  const combined = new Uint8Array(manifestBytes.length + codeHash.length);
  combined.set(manifestBytes, 0);
  combined.set(codeHash, manifestBytes.length);
  return combined.buffer;
}

/** Hash SHA-256 dos bytes dados, via SubtleCrypto. */
async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

/**
 * Representação canónica de um manifesto — `JSON.stringify` com as chaves
 * ordenadas alfabeticamente, sem espaços extra.
 *
 * Sem ordenação, `{b:1,a:2}` e `{a:2,b:1}` produzem strings diferentes apesar
 * de serem o mesmo objeto — e a assinatura de um não bateria no outro. Com
 * `Object.keys().sort()`, a ordem é sempre a mesma, independentemente da
 * engine ou da ordem de inserção.
 */
function canonicalManifestBytes(manifest: PluginManifest): ArrayBuffer {
  // `Object.create(null)`, não `{}`: um campo com o nome `__proto__` num objeto
  // normal ia mexer no protótipo em vez de criar uma propriedade própria, e o
  // `JSON.stringify` descartava-o em silêncio — a assinatura deixava de cobrir
  // o manifesto inteiro.
  const sorted: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const keys = Object.keys(manifest).sort();
  const raw = manifest as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = raw[key];

    // `permissions` e `platforms` também precisam de ordenação canónica.
    if (key === 'permissions' && typeof value === 'object' && value !== null) {
      const permRecord = value as Record<string, unknown>;
      const permSorted: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const permKey of Object.keys(permRecord).sort()) {
        permSorted[permKey] = permRecord[permKey];
      }
      sorted[key] = permSorted;
    } else if (key === 'platforms' && Array.isArray(value)) {
      sorted[key] = (value as unknown[]).slice().sort();
    } else {
      sorted[key] = value;
    }
  }

  return new TextEncoder().encode(JSON.stringify(sorted)).buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
