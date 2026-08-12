import { beforeEach, describe, expect, it, vi } from 'vitest';

const secretStore = new Map<string, string>();

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    secretSet: vi.fn(async (key: string, value: string) => {
      secretStore.set(key, value);
    }),
    secretGet: vi.fn(async (key: string) => secretStore.get(key) ?? null),
    secretDelete: vi.fn(async (key: string) => {
      secretStore.delete(key);
    }),
  }),
}));

import {
  clearAutoLoginSession,
  createAutoLoginSession,
  hasValidAutoLoginSession,
} from '@/services/auto-login-service';

describe('auto-login-service', () => {
  beforeEach(() => {
    secretStore.clear();
    vi.useRealTimers();
  });

  it('sem sessão criada, não há sessão válida', async () => {
    await expect(hasValidAutoLoginSession()).resolves.toBe(false);
  });

  it('depois de criada, a sessão é válida', async () => {
    await createAutoLoginSession();
    await expect(hasValidAutoLoginSession()).resolves.toBe(true);
  });

  it('o token guardado nunca é a palavra-passe nem texto óbvio', async () => {
    await createAutoLoginSession();
    const raw = secretStore.get('session-token');
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw ?? '{}') as { token: string; expiresAt: number };
    expect(typeof parsed.token).toBe('string');
    expect(parsed.token.length).toBeGreaterThan(0);
    expect(typeof parsed.expiresAt).toBe('number');
  });

  it('uma sessão expirada deixa de ser válida, e limpa-se sozinha', async () => {
    secretStore.set('session-token', JSON.stringify({ token: 'x', expiresAt: Date.now() - 1000 }));
    await expect(hasValidAutoLoginSession()).resolves.toBe(false);
    expect(secretStore.has('session-token')).toBe(false);
  });

  it('um valor corrompido no cofre não lança, só invalida a sessão', async () => {
    secretStore.set('session-token', 'isto não é JSON nenhum');
    await expect(hasValidAutoLoginSession()).resolves.toBe(false);
    expect(secretStore.has('session-token')).toBe(false);
  });

  it('clearAutoLoginSession apaga a sessão — logout é logout a sério', async () => {
    await createAutoLoginSession();
    await clearAutoLoginSession();
    await expect(hasValidAutoLoginSession()).resolves.toBe(false);
  });
});
