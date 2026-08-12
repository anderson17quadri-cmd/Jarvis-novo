import { getPlatformAdapter } from '@/platform';

/**
 * Sessão automática após o Windows Hello (Parte 5 §Biometria).
 *
 * Não é uma credencial — é uma marca de "já foste verificada pelo sistema
 * operativo há pouco", guardada no cofre de segredos (nunca em texto
 * simples). A palavra-passe nunca entra aqui: só um token aleatório e uma
 * validade, para saltar o formulário de login por um período curto. Sai só
 * de um login por Windows Hello verificado a sério — nunca da palavra-passe
 * nem do PIN, que já são o próprio ato de autenticação, sem precisarem de
 * um atalho para a próxima vez.
 */

const SESSION_TOKEN_KEY = 'session-token';
/** Tempo que a sessão fica válida sem pedir o Windows Hello outra vez. */
const SESSION_DURATION_MS = 30 * 60_000;

interface StoredToken {
  readonly token: string;
  readonly expiresAt: number;
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Alvo sem `crypto.randomUUID` (browsers antigos) — só precisa de ser
  // imprevisível o suficiente para não colidir, não de segurança
  // criptográfica: a validade real vem de estar no cofre do sistema.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Cria uma sessão nova, válida por `SESSION_DURATION_MS`. */
export async function createAutoLoginSession(): Promise<void> {
  const stored: StoredToken = { token: randomToken(), expiresAt: Date.now() + SESSION_DURATION_MS };
  await getPlatformAdapter().secretSet(SESSION_TOKEN_KEY, JSON.stringify(stored));
}

/** `true` se houver uma sessão válida — e já a consome se estiver expirada. */
export async function hasValidAutoLoginSession(): Promise<boolean> {
  const adapter = getPlatformAdapter();
  const raw = await adapter.secretGet(SESSION_TOKEN_KEY);
  if (!raw) return false;

  let stored: StoredToken;
  try {
    stored = JSON.parse(raw) as StoredToken;
  } catch {
    await adapter.secretDelete(SESSION_TOKEN_KEY);
    return false;
  }

  if (typeof stored.expiresAt !== 'number' || Date.now() >= stored.expiresAt) {
    await adapter.secretDelete(SESSION_TOKEN_KEY);
    return false;
  }

  return true;
}

/** Termina a sessão automática — chamado ao sair, para o logout ser real. */
export async function clearAutoLoginSession(): Promise<void> {
  await getPlatformAdapter().secretDelete(SESSION_TOKEN_KEY);
}
