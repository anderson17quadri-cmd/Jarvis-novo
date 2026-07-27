import { describe, expect, it } from 'vitest';

import { AndroidAdapter } from '@/platform/android-adapter';
import { DesktopAdapter } from '@/platform/desktop-adapter';
import { WebAdapter } from '@/platform/web-adapter';
import { isAllowedExternalUrl } from '@/platform/url-policy';
import { simulateSnapshot } from '@/platform/simulated-metrics';
import type { PlatformAdapter } from '@/platform/platform-adapter';

/**
 * A promessa central do adapter: uma funcionalidade em falta degrada com
 * elegância. Nada aqui pode lançar — se lançasse, a interface teria de saber em
 * que plataforma está, que é exatamente o que a arquitetura proíbe.
 */

const adapters: readonly [string, PlatformAdapter][] = [
  ['DesktopAdapter', new DesktopAdapter()],
  ['AndroidAdapter', new AndroidAdapter()],
  ['WebAdapter', new WebAdapter()],
];

describe('os três adapters cumprem o mesmo contrato', () => {
  it.each(adapters)('%s expõe todas as capacidades', (_name, adapter) => {
    const required = [
      'systemMetrics',
      'processList',
      'systemTray',
      'globalShortcut',
      'windowManagement',
      'nativeNotifications',
      'shellOpen',
      'fileDialogs',
      'nativeStorage',
      'voice',
      'biometrics',
    ] as const;

    for (const key of required) {
      expect(typeof adapter.capabilities[key]).toBe('boolean');
    }
  });

  it.each(adapters)('%s devolve sempre uma função de cancelamento', async (_name, adapter) => {
    const unsubscribe = await adapter.onGlobalInvoke(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it.each(adapters)('%s não lança nos métodos de janela', async (_name, adapter) => {
    await expect(adapter.minimizeWindow()).resolves.toBeUndefined();
    await expect(adapter.toggleMaximizeWindow()).resolves.toBeUndefined();
    await expect(adapter.hideWindow()).resolves.toBeUndefined();
  });
});

describe('Android desliga o que a plataforma não permite', () => {
  const android = new AndroidAdapter();

  it('não tem bandeja, atalho global nem gestão de janelas', () => {
    expect(android.capabilities.systemTray).toBe(false);
    expect(android.capabilities.globalShortcut).toBe(false);
    expect(android.capabilities.windowManagement).toBe(false);
  });

  it('devolve lista de processos vazia sem tocar no IPC', async () => {
    await expect(android.getTopProcesses()).resolves.toEqual([]);
  });
});

describe('WebAdapter simula em vez de falhar', () => {
  const web = new WebAdapter();

  it('devolve uma fotografia completa do sistema', async () => {
    const snapshot = await web.getSystemSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.cpu.usagePercent).toBeGreaterThanOrEqual(0);
    expect(snapshot?.cpu.usagePercent).toBeLessThanOrEqual(100);
  });

  it('guarda e lê preferências', async () => {
    await web.storageSet('theme', 'emerald');
    await expect(web.storageGet('theme', 'classic')).resolves.toBe('emerald');
    await web.storageRemove('theme');
    await expect(web.storageGet('theme', 'classic')).resolves.toBe('classic');
  });

  it('devolve o valor por omissão quando a chave não existe', async () => {
    await expect(web.storageGet('inexistente', 42)).resolves.toBe(42);
  });
});

describe('a política de URLs só deixa passar https e mailto', () => {
  it.each([
    ['https://anthropic.com', true],
    ['mailto:alguem@exemplo.pt', true],
    ['http://exemplo.pt', false],
    ['file:///etc/passwd', false],
    ['javascript:alert(1)', false],
    ['não é um url', false],
    ['', false],
  ])('%s → %s', (url, expected) => {
    expect(isAllowedExternalUrl(url)).toBe(expected);
  });
});

describe('as métricas simuladas mantêm-se dentro de limites plausíveis', () => {
  it('nunca ultrapassa 0–100 nem inventa uma GPU', () => {
    for (let i = 0; i < 50; i++) {
      const snapshot = simulateSnapshot();
      expect(snapshot.cpu.usagePercent).toBeGreaterThanOrEqual(0);
      expect(snapshot.cpu.usagePercent).toBeLessThanOrEqual(100);
      expect(snapshot.memory.usagePercent).toBeLessThanOrEqual(100);
      expect(snapshot.memory.usedBytes).toBeLessThanOrEqual(snapshot.memory.totalBytes);
      // Coerente com o Rust: a GPU não é lida em lado nenhum.
      expect(snapshot.gpu).toBeNull();
    }
  });

  it('dá um valor por núcleo', () => {
    const snapshot = simulateSnapshot(8);
    expect(snapshot.cpu.perCore).toHaveLength(8);
    expect(snapshot.cpu.coreCount).toBe(8);
  });
});
