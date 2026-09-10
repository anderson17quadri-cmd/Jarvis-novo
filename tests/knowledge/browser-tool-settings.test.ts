import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ storage: new Map<string, unknown>() }));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    storageSet: vi.fn(async (key: string, value: unknown) => {
      mocks.storage.set(key, value);
    }),
    storageGet: vi.fn(async (key: string, fallback: unknown) =>
      mocks.storage.has(key) ? mocks.storage.get(key) : fallback,
    ),
    storageRemove: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
  }),
}));

import { useBrowserToolSettingsStore } from '@/stores/use-browser-tool-settings-store';
import { DEFAULT_BROWSER_TOOL_SETTINGS } from '@/types/browser-tool-settings';
import { logService } from '@/services/log-service';

beforeEach(() => {
  mocks.storage.clear();
  logService.clear();
  useBrowserToolSettingsStore.setState({ settings: DEFAULT_BROWSER_TOOL_SETTINGS });
});

describe('desligado por omissão', () => {
  it('arranca desligado', () => {
    expect(useBrowserToolSettingsStore.getState().settings.enabled).toBe(false);
  });
});

describe('setEnabled', () => {
  it('liga e desliga, e regista na auditoria', () => {
    useBrowserToolSettingsStore.getState().setEnabled(true);
    expect(useBrowserToolSettingsStore.getState().settings.enabled).toBe(true);
    expect(logService.list.some((e) => e.source === 'auditoria' && e.message.includes('Ligar'))).toBe(
      true,
    );

    useBrowserToolSettingsStore.getState().setEnabled(false);
    expect(useBrowserToolSettingsStore.getState().settings.enabled).toBe(false);
    expect(logService.list.some((e) => e.source === 'auditoria' && e.message.includes('Desligar'))).toBe(
      true,
    );
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar', async () => {
    useBrowserToolSettingsStore.getState().setEnabled(true);
    await useBrowserToolSettingsStore.getState().persist();

    useBrowserToolSettingsStore.setState({ settings: DEFAULT_BROWSER_TOOL_SETTINGS });
    await useBrowserToolSettingsStore.getState().hydrate();

    expect(useBrowserToolSettingsStore.getState().settings.enabled).toBe(true);
  });

  it('sem nada gravado, arranca desligado', async () => {
    await useBrowserToolSettingsStore.getState().hydrate();
    expect(useBrowserToolSettingsStore.getState().settings.enabled).toBe(false);
  });
});
