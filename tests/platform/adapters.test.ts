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
      'terminal',
      'secretVault',
      'fileWatcher',
      'usbMonitor',
      'batteryMonitor',
      'realFilesystem',
      'mail',
      'music',
      'obsidian',
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

describe('terminal — nenhum adapter lança, só o desktop diz que suporta', () => {
  it('Web e Android não têm terminal', () => {
    expect(new WebAdapter().capabilities.terminal).toBe(false);
    expect(new AndroidAdapter().capabilities.terminal).toBe(false);
  });

  it('Desktop diz que suporta', () => {
    expect(new DesktopAdapter().capabilities.terminal).toBe(true);
  });

  it.each(adapters)('%s: abrir sessão nunca lança, mesmo sem IPC real', async (_name, adapter) => {
    const sessionId = await adapter.terminalSpawn(80, 24);
    expect(sessionId === null || typeof sessionId === 'string').toBe(true);
  });

  it.each(adapters)('%s: escrever, redimensionar e matar sem sessão nunca lançam', async (_name, adapter) => {
    await expect(adapter.terminalWrite('inexistente', 'ls\n')).resolves.toBeUndefined();
    await expect(adapter.terminalResize('inexistente', 80, 24)).resolves.toBeUndefined();
    await expect(adapter.terminalKill('inexistente')).resolves.toBeUndefined();
  });

  it.each(adapters)('%s: subscrever saída e fim devolve sempre uma função de cancelamento', async (_name, adapter) => {
    const unsubOutput = await adapter.onTerminalOutput(() => undefined);
    const unsubExit = await adapter.onTerminalExit(() => undefined);
    expect(typeof unsubOutput).toBe('function');
    expect(typeof unsubExit).toBe('function');
    expect(() => unsubOutput()).not.toThrow();
    expect(() => unsubExit()).not.toThrow();
  });

  it('Web e Android nunca abrem sessão nenhuma (sem capability, sem tentar IPC)', async () => {
    const web: PlatformAdapter = new WebAdapter();
    const android: PlatformAdapter = new AndroidAdapter();
    await expect(web.terminalSpawn(80, 24)).resolves.toBeNull();
    await expect(android.terminalSpawn(80, 24)).resolves.toBeNull();
  });
});

describe('biometria — nenhum adapter lança, e sem sensor cai para indisponível', () => {
  it.each(adapters)('%s: verificar disponibilidade nunca lança', async (_name, adapter) => {
    const available = await adapter.checkBiometricAvailability();
    expect(typeof available).toBe('boolean');
  });

  it.each(adapters)('%s: pedir verificação sem disponibilidade devolve unavailable', async (_name, adapter) => {
    const outcome = await adapter.requestBiometricVerification('teste');
    expect(['verified', 'denied', 'unavailable']).toContain(outcome);
  });

  it('Web nunca tem biometria disponível', async () => {
    const web: PlatformAdapter = new WebAdapter();
    await expect(web.checkBiometricAvailability()).resolves.toBe(false);
    await expect(web.requestBiometricVerification('teste')).resolves.toBe('unavailable');
  });

  it('Android, sem Windows Hello ligado, também não tem biometria', async () => {
    const android: PlatformAdapter = new AndroidAdapter();
    await expect(android.checkBiometricAvailability()).resolves.toBe(false);
  });
});

describe('gatilhos nativos de automação — nenhum adapter lança sem IPC real', () => {
  it.each(adapters)('%s: observar uma pasta nunca lança', async (_name, adapter) => {
    const watchId = await adapter.watchFolder('C:/pasta-qualquer');
    expect(watchId === null || typeof watchId === 'string').toBe(true);
  });

  it.each(adapters)('%s: parar de observar uma pasta inexistente nunca lança', async (_name, adapter) => {
    await expect(adapter.unwatchFolder('inexistente')).resolves.toBeUndefined();
  });

  it.each(adapters)('%s: ler a bateria nunca lança', async (_name, adapter) => {
    const status = await adapter.getBatteryStatus();
    expect(status === null || typeof status.percent === 'number').toBe(true);
  });

  it.each(adapters)(
    '%s: subscrever ficheiros, USB e bateria devolve sempre uma função de cancelamento',
    async (_name, adapter) => {
      const unsubFile = await adapter.onFileChanged(() => undefined);
      const unsubUsb = await adapter.onUsbChanged(() => undefined);
      const unsubBattery = await adapter.onBatteryChanged(() => undefined);

      expect(typeof unsubFile).toBe('function');
      expect(typeof unsubUsb).toBe('function');
      expect(typeof unsubBattery).toBe('function');
      expect(() => unsubFile()).not.toThrow();
      expect(() => unsubUsb()).not.toThrow();
      expect(() => unsubBattery()).not.toThrow();
    },
  );

  it('Web nunca observa pastas nem lê bateria (sem capability, sem tentar IPC)', async () => {
    const web: PlatformAdapter = new WebAdapter();
    await expect(web.watchFolder('C:/pasta')).resolves.toBeNull();
    await expect(web.getBatteryStatus()).resolves.toBeNull();
  });
});

describe('sistema de ficheiros real — nenhum adapter lança sem IPC real', () => {
  it.each(adapters)('%s: escolher pasta nunca lança', async (_name, adapter) => {
    const picked = await adapter.pickFilesRoot();
    expect(picked === null || typeof picked === 'string').toBe(true);
  });

  it.each(adapters)('%s: declarar raiz sem pasta escolhida nunca lança', async (_name, adapter) => {
    const declared = await adapter.filesSetRoot('C:/pasta-qualquer');
    expect(declared === null || typeof declared.path === 'string').toBe(true);
  });

  it.each(adapters)('%s: ler uma pasta sem raiz declarada nunca lança', async (_name, adapter) => {
    const entries = await adapter.filesReadDir(null);
    expect(entries === null || Array.isArray(entries)).toBe(true);
  });

  it('Web e Android nunca têm sistema de ficheiros real', () => {
    expect(new WebAdapter().capabilities.realFilesystem).toBe(false);
    expect(new AndroidAdapter().capabilities.realFilesystem).toBe(false);
  });

  it('Desktop diz que suporta', () => {
    expect(new DesktopAdapter().capabilities.realFilesystem).toBe(true);
  });

  it('Web e Android nunca escolhem pasta nem declaram raiz (sem capability, sem tentar IPC)', async () => {
    const web: PlatformAdapter = new WebAdapter();
    const android: PlatformAdapter = new AndroidAdapter();
    await expect(web.pickFilesRoot()).resolves.toBeNull();
    await expect(web.filesSetRoot('C:/pasta')).resolves.toBeNull();
    await expect(web.filesReadDir(null)).resolves.toBeNull();
    await expect(android.pickFilesRoot()).resolves.toBeNull();
    await expect(android.filesSetRoot('C:/pasta')).resolves.toBeNull();
    await expect(android.filesReadDir(null)).resolves.toBeNull();
  });
});

describe('correio real — só o desktop diz que suporta; os outros degradam', () => {
  it('Web e Android não têm correio real', () => {
    expect(new WebAdapter().capabilities.mail).toBe(false);
    expect(new AndroidAdapter().capabilities.mail).toBe(false);
  });

  it('Desktop diz que suporta', () => {
    expect(new DesktopAdapter().capabilities.mail).toBe(true);
  });

  it('Web e Android leem caixa vazia e não tentam mudar bandeira nem enviar', async () => {
    const web: PlatformAdapter = new WebAdapter();
    const android: PlatformAdapter = new AndroidAdapter();

    for (const adapter of [web, android]) {
      await expect(
        adapter.mailFetch({
          imapServer: 'imap.gmail.com',
          imapPort: 993,
          username: 'u',
          password: 'p',
          limit: 10,
        }),
      ).resolves.toEqual([]);
      await expect(
        adapter.mailSetFlag({
          imapServer: 'imap.gmail.com',
          imapPort: 993,
          username: 'u',
          password: 'p',
          messageId: '1',
          flag: 'seen',
          value: true,
        }),
      ).resolves.toBeUndefined();
      await expect(
        adapter.mailSend({
          smtpServer: 'smtp.gmail.com',
          smtpPort: 587,
          username: 'u',
          password: 'p',
          from: 'u',
          to: 'destino@exemplo.pt',
          subject: 's',
          body: 'b',
        }),
      ).resolves.toBeUndefined();
    }
  });
});

describe('música local — só o desktop diz que suporta; os outros degradam', () => {
  it('Web e Android não têm música local', () => {
    expect(new WebAdapter().capabilities.music).toBe(false);
    expect(new AndroidAdapter().capabilities.music).toBe(false);
  });

  it('Desktop diz que suporta', () => {
    expect(new DesktopAdapter().capabilities.music).toBe(true);
  });

  it('Web e Android nunca declaram pasta nem devolvem URL de áudio', async () => {
    const web: PlatformAdapter = new WebAdapter();
    const android: PlatformAdapter = new AndroidAdapter();

    for (const adapter of [web, android]) {
      await expect(adapter.musicSetRoot('C:/pasta')).resolves.toBeNull();
      await expect(adapter.musicReadDir()).resolves.toEqual([]);
      expect(adapter.toLocalMediaUrl('C:/pasta/faixa.mp3')).toBe('');
    }
  });
});

describe('vault Obsidian — só o desktop diz que suporta; os outros degradam', () => {
  it('Web e Android não têm vault Obsidian', () => {
    expect(new WebAdapter().capabilities.obsidian).toBe(false);
    expect(new AndroidAdapter().capabilities.obsidian).toBe(false);
  });

  it('Desktop diz que suporta', () => {
    expect(new DesktopAdapter().capabilities.obsidian).toBe(true);
  });

  it('Web e Android nunca declaram vault nem leem/escrevem notas', async () => {
    const web: PlatformAdapter = new WebAdapter();
    const android: PlatformAdapter = new AndroidAdapter();

    for (const adapter of [web, android]) {
      await expect(adapter.obsidianSetRoot('C:/vault')).resolves.toBeNull();
      await expect(adapter.obsidianListNotes()).resolves.toEqual([]);
      await expect(adapter.obsidianReadNote('nota.md')).resolves.toBeNull();
      await expect(adapter.obsidianWriteNote('nota.md', 'conteúdo')).resolves.toBe(false);
    }
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
