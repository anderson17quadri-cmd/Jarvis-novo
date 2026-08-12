import type { PlatformAdapter } from './platform-adapter';
import type { PlatformCapabilities, PlatformInfo } from '@/types/platform';
import type { RealFileEntry, RealFilesRoot } from '@/types/real-file-entry';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';
import { detectTouch } from './detect-platform';
import { simulateSnapshot, simulateStaticInfo } from './simulated-metrics';
import { isAllowedExternalUrl } from './url-policy';

/** Prefixo do `localStorage`, para não colidir com outras aplicações no mesmo host. */
const STORAGE_PREFIX = 'jarvis.';

/**
 * Browser — desenvolvimento da interface sem compilar o Tauri.
 *
 * Não há IPC nenhum: as métricas são simuladas e a persistência é o
 * `localStorage`. Tudo o que exige o sistema operativo está desligado nas
 * capacidades, o que faz a interface esconder esses elementos exatamente como
 * fará no Android.
 */
export class WebAdapter implements PlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    // Simuladas, mas presentes: é isso que permite desenhar os gráficos aqui.
    systemMetrics: true,
    processList: false,
    systemTray: false,
    globalShortcut: false,
    windowManagement: false,
    nativeNotifications: false,
    shellOpen: true,
    fileDialogs: false,
    nativeStorage: false,
    voice: typeof window !== 'undefined' && 'speechSynthesis' in window,
    biometrics: false,
    // Sem processo nenhum para abrir um shell dentro de. Um terminal simulado
    // não passaria por real — a janela fica escondida, como o resto do que o
    // browser não sabe fazer.
    terminal: false,
    secretVault: false,
    fileWatcher: false,
    usbMonitor: false,
    batteryMonitor: false,
    realFilesystem: false,
  };

  private resolvedInfo: PlatformInfo | null = null;

  get info(): PlatformInfo {
    return (
      this.resolvedInfo ?? {
        kind: 'web',
        isTauri: false,
        isTouch: detectTouch(),
        osName: null,
        osVersion: null,
        arch: null,
      }
    );
  }

  async initialize(): Promise<void> {
    this.resolvedInfo = {
      kind: 'web',
      isTauri: false,
      isTouch: detectTouch(),
      osName: 'Browser',
      osVersion: null,
      arch: null,
    };
  }

  async getSystemSnapshot(): Promise<SystemSnapshot | null> {
    return simulateSnapshot();
  }

  async getStaticSystemInfo(): Promise<StaticSystemInfo | null> {
    return simulateStaticInfo();
  }

  async getTopProcesses(): Promise<readonly ProcessInfo[]> {
    // Um browser não vê processos. Lista vazia, e a interface esconde o painel.
    return [];
  }

  async storageGet<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  async storageSet<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      // Modo privado ou quota cheia — perder a preferência é aceitável.
    }
  }

  async storageRemove(key: string): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* idem */
    }
  }

  async sendNativeNotification(): Promise<boolean> {
    // Sem notificações nativas: quem chama cai no sistema de toasts interno.
    return false;
  }

  // ── Cofre de segredos ────────────────────────────────────────────────────

  async secretSet(): Promise<boolean> {
    // No browser, nunca se guarda em texto simples. Recusa-se com elegância —
    // quem chama já sabe que não há cofre, não precisa de erro nenhum.
    return false;
  }

  async secretGet(): Promise<string | null> {
    return null;
  }

  async secretDelete(): Promise<boolean> {
    return false;
  }

  async openExternal(url: string): Promise<boolean> {
    if (!isAllowedExternalUrl(url)) return false;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }

  async minimizeWindow(): Promise<void> {
    // Um separador do browser não se minimiza a si próprio.
  }

  async toggleMaximizeWindow(): Promise<void> {
    /* idem */
  }

  async hideWindow(): Promise<void> {
    /* idem */
  }

  async onGlobalInvoke(): Promise<() => void> {
    // Sem atalhos globais. Devolve uma função de cancelamento válida à mesma,
    // para quem chama não precisar de verificar nada.
    return () => undefined;
  }

  async checkBiometricAvailability(): Promise<boolean> {
    return false;
  }

  async requestBiometricVerification(): Promise<'verified' | 'denied' | 'unavailable'> {
    return 'unavailable';
  }

  async terminalSpawn(): Promise<string | null> {
    return null;
  }

  async terminalWrite(): Promise<void> {
    /* sem terminal, sem sessão para escrever */
  }

  async terminalResize(): Promise<void> {
    /* idem */
  }

  async terminalKill(): Promise<void> {
    /* idem */
  }

  async onTerminalOutput(): Promise<() => void> {
    return () => undefined;
  }

  async onTerminalExit(): Promise<() => void> {
    return () => undefined;
  }

  // ── Gatilhos nativos de automação ──────────────────────────────────────────

  async watchFolder(): Promise<string | null> {
    return null;
  }

  async unwatchFolder(): Promise<void> {
    /* sem nativo, sem pasta para observar */
  }

  async getBatteryStatus(): Promise<null> {
    return null;
  }

  async onFileChanged(): Promise<() => void> {
    return () => undefined;
  }

  async onUsbChanged(): Promise<() => void> {
    return () => undefined;
  }

  async onBatteryChanged(): Promise<() => void> {
    return () => undefined;
  }

  // ── Sistema de ficheiros real ────────────────────────────────────────────

  async pickFilesRoot(): Promise<string | null> {
    return null;
  }

  async filesSetRoot(): Promise<RealFilesRoot | null> {
    return null;
  }

  async filesReadDir(): Promise<readonly RealFileEntry[] | null> {
    return null;
  }
}
