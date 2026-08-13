import { getPlatformAdapter } from '@/platform';
import { logService } from '@/services/log-service';

/**
 * Chave física / autenticador (WebAuthn) — Parte 14 §Cofre de segredos, o
 * "chave física continua por fazer" que ficava ao lado do Windows Hello.
 *
 * **O que isto é, com honestidade**: uma cerimónia WebAuthn a sério
 * (`navigator.credentials.create`/`.get`, a mesma API que qualquer site com
 * login por chave física usa) com verificação criptográfica real da
 * assinatura, feita inteiramente no cliente — não há servidor nenhum a
 * validar nada, porque este é um sistema de um só utilizador, sem backend.
 * A confiança na chave pública vem de "fui eu que a registei", não de uma
 * autoridade externa. Isto é diferente de WebAuthn "a sério" num site com
 * milhares de contas (onde o servidor é a raiz de confiança), mas a
 * verificação da assinatura em si — ECDSA P-256 (ES256, COSE alg -7) sobre
 * `authenticatorData || SHA-256(clientDataJSON)` — é a mesma matemática, sem
 * atalhos.
 *
 * **Só ES256 (-7)**. RS256 e outros algoritmos ficam por fazer — a maioria
 * dos autenticadores de plataforma e chaves FIDO2 modernas (YubiKey 5+)
 * oferece ES256 por omissão.
 *
 * **Contagem de assinaturas (`signCount`)**: guardada e comparada como sinal
 * de deteção de clonagem, mas só como melhor esforço — muitos autenticadores
 * de plataforma devolvem sempre 0, o que a spec WebAuthn permite. Uma
 * contagem que não sobe não bloqueia o login sozinha, só fica registada na
 * auditoria.
 */

const CREDENTIAL_VAULT_KEY = 'webauthn-credential';
const RP_NAME = 'JARVIS AI OS';
/** ES256 — ECDSA com P-256 e SHA-256. O único algoritmo suportado por agora. */
const SUPPORTED_ALG = -7;
const CEREMONY_TIMEOUT_MS = 60_000;

export interface StoredCredential {
  /** ID da credencial (`rawId`), base64. */
  readonly credentialId: string;
  /** Chave pública em formato SPKI, base64. */
  readonly publicKeySpki: string;
  /** Algoritmo COSE — sempre -7 (ES256) nesta versão. */
  readonly algorithm: number;
  readonly signCount: number;
  readonly registeredAt: number;
}

export type WebAuthnResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** `true` se este navegador/dispositivo expõe a API WebAuthn. */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

/** `true` se já houver uma chave física registada no cofre. */
export async function hasRegisteredSecurityKey(): Promise<boolean> {
  const raw = await getPlatformAdapter().secretGet(CREDENTIAL_VAULT_KEY);
  return raw !== null;
}

/** Devolve o registo guardado, ou `null` se não houver nenhum ou estiver corrompido. */
export async function getRegisteredSecurityKey(): Promise<StoredCredential | null> {
  const raw = await getPlatformAdapter().secretGet(CREDENTIAL_VAULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

/**
 * Regista uma chave física/autenticador nova. Substitui qualquer registo
 * anterior — só uma chave de cada vez, como o botão único da interface.
 */
export async function registerSecurityKey(userName: string): Promise<WebAuthnResult> {
  if (!isWebAuthnSupported()) {
    return { ok: false, reason: 'Este dispositivo não suporta chaves de segurança (WebAuthn).' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME },
        user: { id: userId, name: userName, displayName: userName },
        challenge,
        pubKeyCredParams: [{ type: 'public-key', alg: SUPPORTED_ALG }],
        authenticatorSelection: { userVerification: 'preferred' },
        attestation: 'none',
        timeout: CEREMONY_TIMEOUT_MS,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return { ok: false, reason: 'Registo cancelado.' };

    const response = credential.response as AuthenticatorAttestationResponse;

    const clientData = decodeClientDataJSON(response.clientDataJSON);
    if (clientData.type !== 'webauthn.create') {
      return { ok: false, reason: 'Tipo de cerimónia inesperado — não é um registo.' };
    }
    if (clientData.challenge !== base64UrlEncode(challenge.buffer)) {
      // Isto nunca devia acontecer numa cerimónia normal — o desafio vem do
      // mesmo pedido que se acabou de fazer. Se não bater certo, algo
      // substituiu a resposta a meio, e aceitar na mesma seria confiar numa
      // cerimónia que pode não ser a que se pediu.
      return { ok: false, reason: 'A resposta não corresponde ao pedido de registo enviado.' };
    }

    if (typeof response.getPublicKey !== 'function') {
      return {
        ok: false,
        reason: 'Este autenticador não expõe a chave pública num formato utilizável.',
      };
    }

    const publicKeySpki = response.getPublicKey();
    const algorithm = response.getPublicKeyAlgorithm?.() ?? SUPPORTED_ALG;

    if (!publicKeySpki) {
      return { ok: false, reason: 'Não foi possível obter a chave pública do autenticador.' };
    }
    if (algorithm !== SUPPORTED_ALG) {
      return {
        ok: false,
        reason: `Algoritmo ${algorithm} não suportado — só ES256 (-7) por agora. Escolhe um autenticador que ofereça ES256.`,
      };
    }

    const stored: StoredCredential = {
      credentialId: arrayBufferToBase64(credential.rawId),
      publicKeySpki: arrayBufferToBase64(publicKeySpki),
      algorithm,
      signCount: 0,
      registeredAt: Date.now(),
    };

    const saved = await getPlatformAdapter().secretSet(CREDENTIAL_VAULT_KEY, JSON.stringify(stored));
    if (!saved) {
      // A cerimónia correu — mas sem cofre nesta plataforma (o browser, por
      // exemplo), guardar a credencial silenciosamente falharia, e dizer
      // "registada" seria mentir. Nunca chegamos aqui no desktop, onde o
      // cofre está sempre disponível.
      return {
        ok: false,
        reason: 'Este dispositivo não tem um cofre de segredos disponível para guardar a chave.',
      };
    }

    logService.audit('Chave física registada', 'executado');
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
}

/** Remove a chave registada, se houver. Idempotente. */
export async function removeSecurityKey(): Promise<void> {
  await getPlatformAdapter().secretDelete(CREDENTIAL_VAULT_KEY);
  logService.audit('Chave física removida', 'executado');
}

/**
 * Pede a cerimónia de verificação e confirma a assinatura contra a chave
 * pública guardada. Só devolve `ok: true` depois de uma verificação
 * criptográfica real — nunca só porque a cerimónia do browser não lançou erro.
 */
export async function verifySecurityKey(): Promise<WebAuthnResult> {
  if (!isWebAuthnSupported()) {
    return { ok: false, reason: 'Este dispositivo não suporta chaves de segurança.' };
  }

  const stored = await getRegisteredSecurityKey();
  if (!stored) {
    return { ok: false, reason: 'Nenhuma chave física registada nesta conta.' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64ToArrayBuffer(stored.credentialId), type: 'public-key' }],
        userVerification: 'preferred',
        timeout: CEREMONY_TIMEOUT_MS,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return { ok: false, reason: 'Verificação cancelada.' };

    const response = assertion.response as AuthenticatorAssertionResponse;

    const clientData = decodeClientDataJSON(response.clientDataJSON);
    if (clientData.type !== 'webauthn.get' || clientData.challenge !== base64UrlEncode(challenge.buffer)) {
      // A verificação da assinatura, por si só, só prova que a resposta foi
      // assinada pela chave privada certa — nunca prova que é a resposta ao
      // desafio que se acabou de enviar. Sem confirmar isto, uma resposta
      // antiga e válida (repetida, ou reaproveitada de outro pedido) passava
      // pela verificação da assinatura sem que ninguém desse por isso — é o
      // passo que impede repetição, não um detalhe cosmético.
      logService.audit(
        'Chave física recusada',
        'recusado',
        'challenge da resposta não corresponde ao pedido enviado — possível repetição',
      );
      return { ok: false, reason: 'A resposta não corresponde ao pedido enviado — possível repetição.' };
    }

    const valid = await verifyAssertionSignature(response, stored.publicKeySpki, stored.algorithm);

    if (!valid) {
      logService.audit('Chave física recusada', 'recusado', 'assinatura não corresponde à chave registada');
      return { ok: false, reason: 'Assinatura inválida — não corresponde à chave registada.' };
    }

    const newSignCount = readSignCount(response.authenticatorData);
    // Melhor esforço: uma contagem que não sobe pode ser um autenticador de
    // plataforma que sempre devolve 0 (normal, WebAuthn permite) ou um sinal
    // de clonagem — não há forma de distinguir os dois só com isto, por isso
    // regista-se sem bloquear.
    if (newSignCount > 0 && newSignCount <= stored.signCount) {
      logService.audit(
        'Chave física: contagem de assinaturas não subiu',
        'permitido',
        `guardada ${stored.signCount}, recebida ${newSignCount} — possível clonagem, ou autenticador que não conta`,
      );
    }

    await getPlatformAdapter().secretSet(
      CREDENTIAL_VAULT_KEY,
      JSON.stringify({ ...stored, signCount: Math.max(newSignCount, stored.signCount) } satisfies StoredCredential),
    );

    logService.audit('Chave física verificada', 'executado');
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
}

// ─── Verificação da assinatura ──────────────────────────────────────────────

async function verifyAssertionSignature(
  response: AuthenticatorAssertionResponse,
  publicKeySpkiBase64: string,
  algorithm: number,
): Promise<boolean> {
  if (algorithm !== SUPPORTED_ALG) return false;

  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      base64ToArrayBuffer(publicKeySpkiBase64),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );

    const clientDataHash = await crypto.subtle.digest('SHA-256', response.clientDataJSON);
    const signedData = concatArrayBuffers(response.authenticatorData, clientDataHash);
    const rawSignature = derToRawEcdsaSignature(new Uint8Array(response.signature));

    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, rawSignature, signedData);
  } catch {
    return false;
  }
}

/**
 * Converte uma assinatura ECDSA em DER (ASN.1 — o formato que os
 * autenticadores WebAuthn produzem) para o formato raw `r || s` de tamanho
 * fixo que o `SubtleCrypto.verify` exige. Os dois formatos não são o mesmo —
 * assumir que são é um erro comum em implementações de WebAuthn caseiras.
 */
function derToRawEcdsaSignature(der: Uint8Array, componentLength = 32): ArrayBuffer {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Assinatura DER inválida: falta SEQUENCE');

  const seqLenByte = der[offset++];
  if (seqLenByte === undefined) throw new Error('Assinatura DER truncada');
  if (seqLenByte & 0x80) offset += seqLenByte & 0x7f; // forma longa — salta os bytes de comprimento

  function readInteger(): Uint8Array {
    if (der[offset++] !== 0x02) throw new Error('Assinatura DER inválida: esperava INTEGER');
    const len = der[offset++];
    if (len === undefined) throw new Error('Assinatura DER truncada');
    const bytes = der.slice(offset, offset + len);
    offset += len;
    return bytes;
  }

  const r = trimOrPad(readInteger(), componentLength);
  const s = trimOrPad(readInteger(), componentLength);

  const raw = new Uint8Array(componentLength * 2);
  raw.set(r, 0);
  raw.set(s, componentLength);
  return raw.buffer;
}

/** DER pode ter um `0x00` inicial (para não ler como negativo) — remove-o; preenche à esquerda se faltar. */
function trimOrPad(bytes: Uint8Array, length: number): Uint8Array {
  let trimmed = bytes;
  while (trimmed.length > length && trimmed[0] === 0x00) trimmed = trimmed.slice(1);
  if (trimmed.length > length) throw new Error('Componente da assinatura maior do que o esperado');
  if (trimmed.length === length) return trimmed;

  const padded = new Uint8Array(length);
  padded.set(trimmed, length - trimmed.length);
  return padded;
}

/** `signCount` vive nos bytes 33-36 de `authenticatorData` (32 rpIdHash + 1 flags), big-endian. */
function readSignCount(authenticatorData: ArrayBuffer): number {
  if (authenticatorData.byteLength < 37) return 0;
  return new DataView(authenticatorData).getUint32(33, false);
}

function concatArrayBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
}

function describeError(error: unknown): string {
  // `DOMException` (o que o browser lança em `NotAllowedError`, por exemplo,
  // quando a pessoa cancela ou demora demasiado) não estende `Error` no
  // Node — por isso a verificação é pela forma (`message`/`name`), não por
  // `instanceof Error`.
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return 'Falha desconhecida na cerimónia WebAuthn.';
}

/**
 * O `clientDataJSON` de qualquer resposta WebAuthn — real ou tentativa de
 * ataque. Nunca lança: um JSON malformado ou campos em falta devolvem um
 * objeto vazio, que falha a verificação de `type`/`challenge` a seguir em
 * vez de rebentar aqui.
 */
function decodeClientDataJSON(buffer: ArrayBuffer): { readonly type?: string; readonly challenge?: string } {
  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as { type?: string; challenge?: string };
  } catch {
    return {};
  }
}

/**
 * O desafio que se manda ao autenticador (`challenge`, um `Uint8Array`) volta
 * no `clientDataJSON.challenge` **em base64url** — sem `+`/`/`, sem
 * preenchimento (`=`) — não em base64 normal. `arrayBufferToBase64` usa-se
 * para guardar a chave/credencial no cofre (onde o formato não importa,
 * contanto que seja consistente); isto é especificamente o que o browser usa
 * para o desafio, e os dois não podem ser trocados.
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
