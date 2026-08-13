import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const secretStore = new Map<string, string>();

// Um objeto só, reutilizado em todas as chamadas a `getPlatformAdapter()` —
// se cada chamada devolvesse um objeto novo, `vi.spyOn(adapter, ...)` nunca
// afetaria o que o serviço realmente usa (o serviço chama
// `getPlatformAdapter()` de novo a cada operação, não guarda a referência).
const mockAdapter = {
  secretSet: vi.fn(async (key: string, value: string) => {
    secretStore.set(key, value);
    return true;
  }),
  secretGet: vi.fn(async (key: string) => secretStore.get(key) ?? null),
  secretDelete: vi.fn(async (key: string) => {
    secretStore.delete(key);
  }),
};

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => mockAdapter,
}));

import {
  getRegisteredSecurityKey,
  hasRegisteredSecurityKey,
  isWebAuthnSupported,
  registerSecurityKey,
  removeSecurityKey,
  verifySecurityKey,
} from '@/services/webauthn-service';

// ─── Auxiliares de teste: constroem o que um autenticador WebAuthn a sério
// produziria, com chaves ECDSA P-256 reais geradas pelo Web Crypto do Node
// (zero chaves fixas no código, mesmo padrão da Peça 5 de assinatura de
// plugins). Nada aqui é mock de matemática — só de `navigator.credentials`.

async function generateKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

function buildAuthenticatorData(signCount: number): ArrayBuffer {
  const rpIdHash = new Uint8Array(32).fill(7);
  const flags = new Uint8Array([0x05]); // UP + UV
  const counter = new Uint8Array(4);
  new DataView(counter.buffer).setUint32(0, signCount, false);

  const out = new Uint8Array(32 + 1 + 4);
  out.set(rpIdHash, 0);
  out.set(flags, 32);
  out.set(counter, 33);
  return out.buffer;
}

/**
 * O desafio (`challenge`) volta no `clientDataJSON` em base64url — cópia da
 * mesma codificação do serviço (`base64UrlEncode`, não exportada), para o
 * teste construir uma resposta que bate certo com o que o serviço vai
 * conferir. Duplicado de propósito: um teste que importasse a função do
 * próprio serviço não provava nada sobre ela.
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * `clientDataJSON` real, com o desafio que o pedido concreto mandou — nunca
 * um valor fixo. O código sob teste agora confere `clientData.challenge`
 * contra o desafio que ele próprio gerou; um valor fixo faria os testes
 * falharem sempre, ou (pior) passar por acidente sem testar nada a sério.
 */
function buildClientDataJSON(challenge: ArrayBuffer, type: 'webauthn.create' | 'webauthn.get'): ArrayBuffer {
  const json = JSON.stringify({
    type,
    challenge: base64UrlEncode(challenge),
    origin: 'http://localhost',
    crossOrigin: false,
  });
  return new TextEncoder().encode(json).buffer;
}

/** Lê o `challenge` que o serviço passou a `navigator.credentials.create/get`. */
function challengeFrom(options: { publicKey?: { challenge?: BufferSource } }): ArrayBuffer {
  const challenge = options.publicKey?.challenge;
  if (!challenge) throw new Error('teste mal construído: sem challenge nas opções');
  if (challenge instanceof ArrayBuffer) return challenge;
  const view = challenge as Uint8Array;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/** Codifica dois inteiros DER a partir do formato raw que o SubtleCrypto devolve. */
function encodeDerInteger(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let trimmed = bytes.slice(i);
  if ((trimmed[0] ?? 0) & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded.set(trimmed, 1);
    trimmed = padded;
  }
  return new Uint8Array([0x02, trimmed.length, ...trimmed]);
}

/**
 * O `SubtleCrypto.sign` do WebCrypto devolve ECDSA em formato raw `r || s` —
 * mas um autenticador WebAuthn a sério manda DER. Esta função simula esse
 * passo, para o teste exercitar a conversão real (`derToRawEcdsaSignature`
 * dentro do serviço), não contorná-la.
 */
function rawSignatureToDer(raw: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(raw);
  const r = bytes.slice(0, 32);
  const s = bytes.slice(32, 64);
  const rEnc = encodeDerInteger(r);
  const sEnc = encodeDerInteger(s);
  const body = new Uint8Array([...rEnc, ...sEnc]);
  return new Uint8Array([0x30, body.length, ...body]).buffer;
}

async function signAssertion(
  privateKey: CryptoKey,
  authenticatorData: ArrayBuffer,
  clientDataJSON: ArrayBuffer,
): Promise<ArrayBuffer> {
  const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON);
  const signedData = new Uint8Array(authenticatorData.byteLength + clientDataHash.byteLength);
  signedData.set(new Uint8Array(authenticatorData), 0);
  signedData.set(new Uint8Array(clientDataHash), authenticatorData.byteLength);

  const rawSignature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signedData);
  return rawSignatureToDer(rawSignature);
}

function stubWebAuthnSupport(supported: boolean): void {
  if (supported) {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
      writable: true,
    });
  } else {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
}

function stubCredentials(create: unknown, get: unknown): void {
  Object.defineProperty(navigator, 'credentials', {
    value: { create, get },
    configurable: true,
    writable: true,
  });
}

describe('webauthn-service', () => {
  beforeEach(() => {
    secretStore.clear();
    stubWebAuthnSupport(true);
    stubCredentials(vi.fn(), vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isWebAuthnSupported / hasRegisteredSecurityKey', () => {
    it('sem PublicKeyCredential no browser, não é suportado', () => {
      stubWebAuthnSupport(false);
      expect(isWebAuthnSupported()).toBe(false);
    });

    it('com PublicKeyCredential, é suportado', () => {
      expect(isWebAuthnSupported()).toBe(true);
    });

    it('sem registo nenhum, hasRegisteredSecurityKey é falso', async () => {
      await expect(hasRegisteredSecurityKey()).resolves.toBe(false);
    });
  });

  describe('registerSecurityKey', () => {
    it('sem suporte WebAuthn, recusa com motivo claro', async () => {
      stubWebAuthnSupport(false);
      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/não suporta/i);
    });

    it('regista com sucesso quando o autenticador devolve ES256', async () => {
      const keyPair = await generateKeyPair();
      const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);

      stubCredentials(
        vi.fn(async (options) => ({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: {
            getPublicKey: () => publicKeySpki,
            getPublicKeyAlgorithm: () => -7,
            clientDataJSON: buildClientDataJSON(challengeFrom(options), 'webauthn.create'),
          },
        })),
        vi.fn(),
      );

      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(true);
      await expect(hasRegisteredSecurityKey()).resolves.toBe(true);

      const stored = await getRegisteredSecurityKey();
      expect(stored?.algorithm).toBe(-7);
      expect(stored?.signCount).toBe(0);
    });

    it('recusa um algoritmo diferente de ES256', async () => {
      const keyPair = await generateKeyPair();
      const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);

      stubCredentials(
        vi.fn(async (options) => ({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: {
            getPublicKey: () => publicKeySpki,
            getPublicKeyAlgorithm: () => -257, // RS256, não suportado
            clientDataJSON: buildClientDataJSON(challengeFrom(options), 'webauthn.create'),
          },
        })),
        vi.fn(),
      );

      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/ES256/);
      await expect(hasRegisteredSecurityKey()).resolves.toBe(false);
    });

    it('registo cancelado (credential null) recusa sem lançar', async () => {
      stubCredentials(vi.fn(async () => null), vi.fn());
      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/cancelado/i);
    });

    it('autenticador sem getPublicKey (Level 2) recusa com motivo claro', async () => {
      stubCredentials(
        vi.fn(async (options) => ({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: { clientDataJSON: buildClientDataJSON(challengeFrom(options), 'webauthn.create') },
        })),
        vi.fn(),
      );

      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/chave pública/i);
    });

    it('cerimónia bem-sucedida mas sem cofre disponível (ex.: browser) não finge sucesso', async () => {
      const keyPair = await generateKeyPair();
      const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);

      stubCredentials(
        vi.fn(async (options) => ({
          rawId: new Uint8Array([1, 2, 3]).buffer,
          response: {
            getPublicKey: () => publicKeySpki,
            getPublicKeyAlgorithm: () => -7,
            clientDataJSON: buildClientDataJSON(challengeFrom(options), 'webauthn.create'),
          },
        })),
        vi.fn(),
      );

      mockAdapter.secretSet.mockResolvedValueOnce(false);

      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/cofre/i);
      await expect(hasRegisteredSecurityKey()).resolves.toBe(false);
    });

    it('erro na cerimónia (ex.: utilizador recusou no SO) não lança, devolve motivo', async () => {
      stubCredentials(
        vi.fn(async () => {
          throw new DOMException('The operation was cancelled by the user.', 'NotAllowedError');
        }),
        vi.fn(),
      );

      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/cancelled/i);
    });
  });

  describe('verifySecurityKey — verificação criptográfica real', () => {
    async function registerRealKey(): Promise<CryptoKeyPair> {
      const keyPair = await generateKeyPair();
      const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);

      stubCredentials(
        vi.fn(async (options) => ({
          rawId: new Uint8Array([9, 9, 9]).buffer,
          response: {
            getPublicKey: () => publicKeySpki,
            getPublicKeyAlgorithm: () => -7,
            clientDataJSON: buildClientDataJSON(challengeFrom(options), 'webauthn.create'),
          },
        })),
        vi.fn(),
      );

      const result = await registerSecurityKey('Anderson');
      expect(result.ok).toBe(true);
      return keyPair;
    }

    it('sem chave registada, recusa antes de pedir cerimónia nenhuma', async () => {
      const get = vi.fn();
      stubCredentials(vi.fn(), get);

      const result = await verifySecurityKey();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/nenhuma chave/i);
      expect(get).not.toHaveBeenCalled();
    });

    it('assinatura válida (chave certa, DER→raw convertido) verifica com sucesso', async () => {
      const keyPair = await registerRealKey();

      const authenticatorData = buildAuthenticatorData(1);

      stubCredentials(
        vi.fn(),
        vi.fn(async (options) => {
          const clientDataJSON = buildClientDataJSON(challengeFrom(options), 'webauthn.get');
          const signature = await signAssertion(keyPair.privateKey, authenticatorData, clientDataJSON);
          return { response: { authenticatorData, clientDataJSON, signature } };
        }),
      );

      const result = await verifySecurityKey();
      expect(result.ok).toBe(true);

      // A contagem de assinaturas fica atualizada no cofre.
      const stored = await getRegisteredSecurityKey();
      expect(stored?.signCount).toBe(1);
    });

    it('assinatura de uma chave diferente (não a registada) é recusada', async () => {
      await registerRealKey();
      const impostor = await generateKeyPair();

      const authenticatorData = buildAuthenticatorData(1);

      stubCredentials(
        vi.fn(),
        vi.fn(async (options) => {
          const clientDataJSON = buildClientDataJSON(challengeFrom(options), 'webauthn.get');
          // Assina com a chave errada — a verificação tem de falhar.
          const signature = await signAssertion(impostor.privateKey, authenticatorData, clientDataJSON);
          return { response: { authenticatorData, clientDataJSON, signature } };
        }),
      );

      const result = await verifySecurityKey();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/assinatura inválida/i);
    });

    it('clientDataJSON alterado depois de assinar invalida a assinatura', async () => {
      const keyPair = await registerRealKey();

      const authenticatorData = buildAuthenticatorData(1);

      stubCredentials(
        vi.fn(),
        vi.fn(async (options) => {
          const challenge = challengeFrom(options);
          const originalClientData = buildClientDataJSON(challenge, 'webauthn.get');
          const signature = await signAssertion(keyPair.privateKey, authenticatorData, originalClientData);

          // O `clientDataJSON` que chega à verificação é diferente do
          // assinado — simula uma cerimónia adulterada a meio. O `challenge`
          // mantém-se correto de propósito: isto testa que a assinatura em
          // si é recusada quando os bytes assinados mudam, não que o
          // `challenge` errado é apanhado primeiro (isso já tem teste próprio).
          const tamperedClientData = new TextEncoder().encode(
            JSON.stringify({
              type: 'webauthn.get',
              challenge: base64UrlEncode(challenge),
              origin: 'http://sitio-diferente.invalido',
              crossOrigin: false,
            }),
          ).buffer;

          return { response: { authenticatorData, clientDataJSON: tamperedClientData, signature } };
        }),
      );

      const result = await verifySecurityKey();
      expect(result.ok).toBe(false);
    });

    it('challenge da resposta não corresponde ao pedido (repetição) é recusado antes da assinatura', async () => {
      const keyPair = await registerRealKey();

      const authenticatorData = buildAuthenticatorData(1);
      // Um challenge completamente diferente do que o serviço pediu —
      // simula uma resposta antiga a ser reaproveitada.
      const staleChallenge = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const clientDataJSON = buildClientDataJSON(staleChallenge, 'webauthn.get');
      const signature = await signAssertion(keyPair.privateKey, authenticatorData, clientDataJSON);

      stubCredentials(
        vi.fn(),
        vi.fn(async () => ({ response: { authenticatorData, clientDataJSON, signature } })),
      );

      const result = await verifySecurityKey();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/repetição/i);
    });

    it('verificação cancelada (assertion null) recusa sem lançar', async () => {
      await registerRealKey();
      stubCredentials(vi.fn(), vi.fn(async () => null));

      const result = await verifySecurityKey();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/cancelada/i);
    });

    it('signCount que não sobe não bloqueia — só fica registado (melhor esforço)', async () => {
      const keyPair = await registerRealKey();

      // Primeira verificação com signCount 5.
      const authData1 = buildAuthenticatorData(5);
      stubCredentials(
        vi.fn(),
        vi.fn(async (options) => {
          const clientData1 = buildClientDataJSON(challengeFrom(options), 'webauthn.get');
          const sig1 = await signAssertion(keyPair.privateKey, authData1, clientData1);
          return { response: { authenticatorData: authData1, clientDataJSON: clientData1, signature: sig1 } };
        }),
      );
      await expect(verifySecurityKey()).resolves.toEqual({ ok: true });

      // Segunda verificação com signCount igual (não subiu) — continua a verificar.
      const authData2 = buildAuthenticatorData(5);
      stubCredentials(
        vi.fn(),
        vi.fn(async (options) => {
          const clientData2 = buildClientDataJSON(challengeFrom(options), 'webauthn.get');
          const sig2 = await signAssertion(keyPair.privateKey, authData2, clientData2);
          return { response: { authenticatorData: authData2, clientDataJSON: clientData2, signature: sig2 } };
        }),
      );
      const result = await verifySecurityKey();
      expect(result.ok).toBe(true);
    });

    it('sem suporte WebAuthn, recusa sem tentar ler o cofre', async () => {
      await registerRealKey();
      stubWebAuthnSupport(false);

      const result = await verifySecurityKey();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/não suporta/i);
    });
  });

  describe('removeSecurityKey', () => {
    it('remove um registo existente', async () => {
      const keyPair = await generateKeyPair();
      const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      stubCredentials(
        vi.fn(async (options) => ({
          rawId: new Uint8Array([1]).buffer,
          response: {
            getPublicKey: () => publicKeySpki,
            getPublicKeyAlgorithm: () => -7,
            clientDataJSON: buildClientDataJSON(challengeFrom(options), 'webauthn.create'),
          },
        })),
        vi.fn(),
      );
      await registerSecurityKey('Anderson');
      await expect(hasRegisteredSecurityKey()).resolves.toBe(true);

      await removeSecurityKey();
      await expect(hasRegisteredSecurityKey()).resolves.toBe(false);
    });

    it('é idempotente — remover sem nada registado não lança', async () => {
      await expect(removeSecurityKey()).resolves.toBeUndefined();
    });
  });
});
