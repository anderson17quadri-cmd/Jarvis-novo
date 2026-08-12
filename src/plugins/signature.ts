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
 * A assinatura cobre o JSON canónico do manifesto:
 * `JSON.stringify(manifesto, Object.keys(manifesto).sort())` — sem espaços
 * extra, com as chaves sempre na mesma ordem, para o mesmo manifesto produzir
 * sempre os mesmos bytes independentemente de quem o serializou.
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

/** Um manifesto assinado pelo autor. */
export interface SignedManifest {
  readonly manifest: PluginManifest;
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
 * Assina um manifesto com a chave privada dada.
 *
 * A assinatura cobre a representação canónica do manifesto — `JSON.stringify`
 * com as chaves ordenadas, sem espaços extra. Isto garante que o mesmo
 * manifesto produz sempre a mesma assinatura, independentemente da ordem de
 * inserção das chaves em memória.
 */
export async function signManifest(
  manifest: PluginManifest,
  privateKeyBase64: string,
): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyBase64);
  const canonical = canonicalManifestBytes(manifest);
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, canonical);
  return arrayBufferToBase64(signature);
}

// ─── Verificar ──────────────────────────────────────────────────────────────

/**
 * Verifica a assinatura de um manifesto contra a chave pública do signatário.
 *
 * Devolve `true` se a assinatura for matematicamente válida — **não** verifica
 * revogação. Usa `verifySignedManifest` para a verificação completa.
 */
export async function verifyManifestSignature(
  manifest: PluginManifest,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<boolean> {
  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const canonical = canonicalManifestBytes(manifest);
    const signature = base64ToArrayBuffer(signatureBase64);

    return await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, signature, canonical);
  } catch {
    // Chave mal formatada, assinatura com tamanho errado — não é válida.
    return false;
  }
}

/**
 * Verificação completa: assinatura + lista de revogação.
 *
 * Só devolve `assinado-valido` se a assinatura for matematicamente correta
 * **e** a chave não estiver na lista de revogação.
 */
export async function verifySignedManifest(signed: SignedManifest): Promise<SignatureStatus> {
  if (isKeyRevoked(signed.signerPublicKey)) {
    return 'chave-revogada';
  }

  const valid = await verifyManifestSignature(
    signed.manifest,
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
  readonly signature?: string;
  readonly signerPublicKey?: string;
}): Promise<SignatureStatus> {
  if (!entry.signature || !entry.signerPublicKey) {
    return 'sem-assinatura';
  }

  return verifySignedManifest({
    manifest: entry.manifest,
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
 * Representação canónica de um manifesto — `JSON.stringify` com as chaves
 * ordenadas alfabeticamente, sem espaços extra.
 *
 * Sem ordenação, `{b:1,a:2}` e `{a:2,b:1}` produzem strings diferentes apesar
 * de serem o mesmo objeto — e a assinatura de um não bateria no outro. Com
 * `Object.keys().sort()`, a ordem é sempre a mesma, independentemente da
 * engine ou da ordem de inserção.
 */
function canonicalManifestBytes(manifest: PluginManifest): ArrayBuffer {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(manifest).sort();
  const raw = manifest as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = raw[key];

    // `permissions` e `platforms` também precisam de ordenação canónica.
    if (key === 'permissions' && typeof value === 'object' && value !== null) {
      const permRecord = value as Record<string, unknown>;
      const permSorted: Record<string, unknown> = {};
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
