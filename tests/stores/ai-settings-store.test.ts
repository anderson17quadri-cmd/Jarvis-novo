import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A migração da chave da API de texto simples (storage) para o cofre, no
 * `hydrate()` da store. O ponto que estes testes prendem: a cópia para o
 * cofre é a única cópia nova — se ela falhar, a chave tem de continuar no
 * storage, nunca ser apagada. Perder a chave (nem no storage nem no cofre)
 * seria pior do que ela ficar em texto simples mais um arranque.
 */

const vault = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  secrets: new Map<string, string>(),
  failWrites: false,
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    capabilities: { secretVault: true },
    storageGet: vi.fn(async (key: string, fallback: unknown) =>
      vault.storage.has(key) ? vault.storage.get(key) : fallback,
    ),
    storageSet: vi.fn(async (key: string, value: unknown) => {
      vault.storage.set(key, value);
    }),
    storageRemove: vi.fn(async (key: string) => {
      vault.storage.delete(key);
    }),
    secretSet: vi.fn(async (key: string, value: string) => {
      if (vault.failWrites) return false;
      vault.secrets.set(key, value);
      return true;
    }),
    secretGet: vi.fn(async (key: string) => vault.secrets.get(key) ?? null),
    secretDelete: vi.fn(async (key: string) => {
      vault.secrets.delete(key);
      return true;
    }),
  }),
}));

import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import { DEFAULT_AI_SETTINGS } from '@/types/ai-provider-settings';

beforeEach(() => {
  vault.storage.clear();
  vault.secrets.clear();
  vault.failWrites = false;
  useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
});

describe('migração da chave para o cofre', () => {
  it('move a chave em texto simples para o cofre e limpa o storage', async () => {
    vault.storage.set('ai-settings', { provider: 'deepseek', apiKey: 'sk-antiga' });

    await useAiSettingsStore.getState().hydrate();

    expect(vault.secrets.get('deepseek-api-key')).toBe('sk-antiga');
    expect(vault.secrets.get('jarvis-migrated')).toBe('1');

    const restante = vault.storage.get('ai-settings') as Record<string, unknown>;
    expect(restante.provider).toBe('deepseek');
    expect(Object.prototype.hasOwnProperty.call(restante, 'apiKey')).toBe(false);

    expect(useAiSettingsStore.getState().settings.apiKey).toBe('sk-antiga');
  });

  it('se o cofre falhar, a chave continua no storage — nunca se perde', async () => {
    vault.storage.set('ai-settings', { provider: 'deepseek', apiKey: 'sk-antiga' });
    vault.failWrites = true;

    await useAiSettingsStore.getState().hydrate();

    // A cópia para o cofre falhou, por isso o texto simples NÃO foi apagado.
    const restante = vault.storage.get('ai-settings') as Record<string, unknown>;
    expect(restante.apiKey).toBe('sk-antiga');
    // E não se marca como migrada — volta a tentar no arranque seguinte.
    expect(vault.secrets.has('jarvis-migrated')).toBe(false);
  });

  it('a migração só corre uma vez: com o marcador, não volta a mexer', async () => {
    vault.storage.set('ai-settings', { provider: 'deepseek', apiKey: 'sk-antiga' });
    vault.secrets.set('jarvis-migrated', '1');
    vault.secrets.set('deepseek-api-key', 'sk-no-cofre');

    await useAiSettingsStore.getState().hydrate();

    // O marcador impede a migração — o storage mantém o que tinha.
    const restante = vault.storage.get('ai-settings') as Record<string, unknown>;
    expect(restante.apiKey).toBe('sk-antiga');
    // E o cofre continua com o valor já lá guardado.
    expect(vault.secrets.get('deepseek-api-key')).toBe('sk-no-cofre');
  });
});

describe('persistir com o cofre disponível', () => {
  it('quando o cofre guarda bem, o storage fica sem a chave e o cofre com ela', async () => {
    vault.secrets.set('jarvis-migrated', '1');
    useAiSettingsStore.setState({
      settings: { ...DEFAULT_AI_SETTINGS, provider: 'deepseek', apiKey: 'sk-nova' },
    });

    await useAiSettingsStore.getState().persist();

    expect(vault.secrets.get('deepseek-api-key')).toBe('sk-nova');
    const restante = vault.storage.get('ai-settings') as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(restante, 'apiKey')).toBe(false);
  });

  it('se o cofre falhar ao guardar, a chave fica no storage — nunca em lado nenhum', async () => {
    vault.secrets.set('jarvis-migrated', '1');
    vault.failWrites = true;
    useAiSettingsStore.setState({
      settings: { ...DEFAULT_AI_SETTINGS, provider: 'deepseek', apiKey: 'sk-nova' },
    });

    await useAiSettingsStore.getState().persist();

    const restante = vault.storage.get('ai-settings') as Record<string, unknown>;
    expect(restante.apiKey).toBe('sk-nova');
    expect(vault.secrets.get('deepseek-api-key')).toBeUndefined();
  });

  it('ao reiniciar depois de uma escrita falhada, a chave sobrevive pelo storage', async () => {
    vault.secrets.set('jarvis-migrated', '1');
    vault.failWrites = true;
    useAiSettingsStore.setState({
      settings: { ...DEFAULT_AI_SETTINGS, provider: 'deepseek', apiKey: 'sk-nova' },
    });

    await useAiSettingsStore.getState().persist();

    // Reinício: a store volta ao estado por omissão e hidrata do storage.
    useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
    await useAiSettingsStore.getState().hydrate();

    expect(useAiSettingsStore.getState().settings.apiKey).toBe('sk-nova');
  });
});
