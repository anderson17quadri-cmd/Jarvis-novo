import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { load, type Store } from '@tauri-apps/plugin-store';
import { arch as osArch, platform as osPlatform, version as osVersion } from '@tauri-apps/plugin-os';

import type { PlatformAdapter } from './platform-adapter';
import type { PlatformCapabilities, PlatformInfo, PlatformKind } from '@/types/platform';
import type { RealFileEntry, RealFilesRoot } from '@/types/real-file-entry';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';
import type { TerminalExitEvent, TerminalOutputEvent } from '@/types/terminal';
import { detectTouch } from './detect-platform';
import { isAllowedExternalUrl } from './url-policy';

/** Nomes dos eventos que o Rust emite — ver `src-tauri/src/terminal/session.rs`. */
const TERMINAL_OUTPUT_EVENT = 'terminal://output';
const TERMINAL_EXIT_EVENT = 'terminal://exit';

/** Ficheiro do plugin `store` onde as preferências persistem. */
const STORE_FILE = 'jarvis.store.json';

/** Evento emitido pelo Rust quando o atalho global dispara. */
const GLOBAL_INVOKE_EVENT = 'jarvis://global-invoke';

/** Eventos emitidos pelos monitores nativos de automação. */
const BATTERY_EVENT = 'automation://battery-changed';
const USB_EVENT = 'automation://usb-changed';
const FILE_EVENT = 'automation://file-changed';

/**
 * O que o desktop e o Android têm em comum: ambos correm dentro do Tauri e
 * partilham o IPC, o `store`, as notificações nativas e o `shell`.
 *
 * As subclasses só declaram o que muda — as capacidades e os métodos que a sua
 * plataforma não suporta. É isto que evita duplicar o adapter inteiro duas vezes.
 */
export abstract class TauriAdapterBase implements PlatformAdapter {
  abstract readonly capabilities: PlatformCapabilities;
  protected abstract readonly kind: PlatformKind;

  private resolvedInfo: PlatformInfo | null = null;
  private storePromise: Promise<Store> | null = null;

  get info(): PlatformInfo {
    return (
      this.resolvedInfo ?? {
        kind: this.kind,
        isTauri: true,
        isTouch: detectTouch(),
        osName: null,
        osVersion: null,
        arch: null,
      }
    );
  }

  async initialize(): Promise<void> {
    // O plugin `os` é síncrono, mas envolvemo-lo à mesma: se o plugin não
    // estiver registado, a informação fica a `null` em vez de rebentar.
    let osName: string | null = null;
    let version: string | null = null;
    let architecture: string | null = null;

    try {
      osName = osPlatform();
      version = osVersion();
      architecture = osArch();
    } catch {
      // Informação decorativa — a aplicação funciona sem ela.
    }

    this.resolvedInfo = {
      kind: this.kind,
      isTauri: true,
      isTouch: detectTouch(),
      osName,
      osVersion: version,
      arch: architecture,
    };
  }

  // ── Sistema ──────────────────────────────────────────────────────────────

  async getSystemSnapshot(): Promise<SystemSnapshot | null> {
    if (!this.capabilities.systemMetrics) return null;
    return this.tryInvoke<SystemSnapshot>('get_system_snapshot', null);
  }

  async getStaticSystemInfo(): Promise<StaticSystemInfo | null> {
    if (!this.capabilities.systemMetrics) return null;
    return this.tryInvoke<StaticSystemInfo>('get_static_system_info', null);
  }

  async getTopProcesses(limit?: number): Promise<readonly ProcessInfo[]> {
    if (!this.capabilities.processList) return [];
    const result = await this.tryInvoke<ProcessInfo[]>('get_top_processes', null, { limit });
    return result ?? [];
  }

  // ── Persistência ─────────────────────────────────────────────────────────

  private getStore(): Promise<Store> {
    // `load` é caro; guardamos a promessa para não abrir o ficheiro em cada uso.
    this.storePromise ??= load(STORE_FILE, { autoSave: true });
    return this.storePromise;
  }

  async storageGet<T>(key: string, fallback: T): Promise<T> {
    try {
      const store = await this.getStore();
      const value = await store.get<T>(key);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  async storageSet<T>(key: string, value: T): Promise<void> {
    try {
      const store = await this.getStore();
      await store.set(key, value);
    } catch {
      // Perder uma preferência não pode partir a aplicação.
    }
  }

  async storageRemove(key: string): Promise<void> {
    try {
      const store = await this.getStore();
      await store.delete(key);
    } catch {
      /* idem */
    }
  }

  // ── Notificações ─────────────────────────────────────────────────────────

  async sendNativeNotification(title: string, body: string): Promise<boolean> {
    if (!this.capabilities.nativeNotifications) return false;
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === 'granted';
      }
      if (!granted) return false;
      sendNotification({ title, body });
      return true;
    } catch {
      // Quem chama cai no toast interno.
      return false;
    }
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  async openExternal(url: string): Promise<boolean> {
    // Primeira barreira: a lista de esquemas permitidos, do lado da interface.
    // A segunda é a capability do Tauri, que rejeita o resto no lado Rust.
    if (!this.capabilities.shellOpen || !isAllowedExternalUrl(url)) return false;
    try {
      await shellOpen(url);
      return true;
    } catch {
      return false;
    }
  }

  // ── Cofre de segredos ────────────────────────────────────────────────────

  async secretSet(key: string, value: string): Promise<boolean> {
    if (!this.capabilities.secretVault) return false;
    const result = await this.tryInvoke<null>('secret_set', null, { key, value });
    return result !== null;
  }

  async secretGet(key: string): Promise<string | null> {
    if (!this.capabilities.secretVault) return null;
    return this.tryInvoke<string | null>('secret_get', null, { key });
  }

  async secretDelete(key: string): Promise<boolean> {
    if (!this.capabilities.secretVault) return false;
    const result = await this.tryInvoke<null>('secret_delete', null, { key });
    return result !== null;
  }

  // ── Gatilhos nativos de automação ──────────────────────────────────────────

  async watchFolder(path: string): Promise<string | null> {
    if (!this.capabilities.fileWatcher) return null;
    return this.tryInvoke<string>('watch_folder', null, { path });
  }

  async unwatchFolder(watchId: string): Promise<void> {
    if (!this.capabilities.fileWatcher) return;
    await this.tryInvoke('unwatch_folder', null, { watchId });
  }

  async getBatteryStatus(): Promise<{ percent: number; isCharging: boolean; isPlugged: boolean } | null> {
    if (!this.capabilities.batteryMonitor) return null;
    return this.tryInvoke<{ percent: number; isCharging: boolean; isPlugged: boolean }>(
      'get_battery_status',
      null,
    );
  }

  async onFileChanged(
    handler: (event: { path: string; watchId: string; changeKind: string }) => void,
  ): Promise<() => void> {
    if (!this.capabilities.fileWatcher) return () => undefined;
    try {
      const unlisten = await listen<{ path: string; watchId: string; changeKind: string }>(
        FILE_EVENT,
        (event) => handler(event.payload),
      );
      return unlisten;
    } catch {
      return () => undefined;
    }
  }

  async onUsbChanged(
    handler: (event: { action: string; deviceName: string | null }) => void,
  ): Promise<() => void> {
    if (!this.capabilities.usbMonitor) return () => undefined;
    try {
      const unlisten = await listen<{ action: string; deviceName: string | null }>(
        USB_EVENT,
        (event) => handler(event.payload),
      );
      return unlisten;
    } catch {
      return () => undefined;
    }
  }

  async onBatteryChanged(
    handler: (event: { percent: number; isCharging: boolean; isPlugged: boolean }) => void,
  ): Promise<() => void> {
    if (!this.capabilities.batteryMonitor) return () => undefined;
    try {
      const unlisten = await listen<{ percent: number; isCharging: boolean; isPlugged: boolean }>(
        BATTERY_EVENT,
        (event) => handler(event.payload),
      );
      return unlisten;
    } catch {
      return () => undefined;
    }
  }

  // ── Janela nativa ────────────────────────────────────────────────────────

  async minimizeWindow(): Promise<void> {
    if (!this.capabilities.windowManagement) return;
    try {
      await getCurrentWindow().minimize();
    } catch {
      /* sem gestão de janelas — ignorar */
    }
  }

  async toggleMaximizeWindow(): Promise<void> {
    if (!this.capabilities.windowManagement) return;
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {
      /* idem */
    }
  }

  async hideWindow(): Promise<void> {
    if (!this.capabilities.windowManagement) return;
    try {
      await getCurrentWindow().hide();
    } catch {
      /* idem */
    }
  }

  // ── Atalho global ────────────────────────────────────────────────────────

  async onGlobalInvoke(handler: () => void): Promise<() => void> {
    if (!this.capabilities.globalShortcut) return () => undefined;
    try {
      const unlisten = await listen(GLOBAL_INVOKE_EVENT, () => handler());
      return unlisten;
    } catch {
      return () => undefined;
    }
  }

  // ── Biometria ────────────────────────────────────────────────────────────

  async checkBiometricAvailability(): Promise<boolean> {
    if (!this.capabilities.biometrics) return false;
    return (await this.tryInvoke<boolean>('windows_hello_available', false)) ?? false;
  }

  async requestBiometricVerification(message: string): Promise<'verified' | 'denied' | 'unavailable'> {
    if (!this.capabilities.biometrics) return 'unavailable';
    const result = await this.tryInvoke<'verified' | 'denied' | 'unavailable'>(
      'windows_hello_verify',
      'unavailable',
      { message },
    );
    return result ?? 'unavailable';
  }

  // ── Terminal ─────────────────────────────────────────────────────────────

  async terminalSpawn(cols: number, rows: number): Promise<string | null> {
    if (!this.capabilities.terminal) return null;
    return this.tryInvoke<string>('terminal_spawn', null, { cols, rows });
  }

  async terminalWrite(sessionId: string, data: string): Promise<void> {
    if (!this.capabilities.terminal) return;
    await this.tryInvoke('terminal_write', null, { sessionId, data });
  }

  async terminalResize(sessionId: string, cols: number, rows: number): Promise<void> {
    if (!this.capabilities.terminal) return;
    await this.tryInvoke('terminal_resize', null, { sessionId, cols, rows });
  }

  async terminalKill(sessionId: string): Promise<void> {
    if (!this.capabilities.terminal) return;
    await this.tryInvoke('terminal_kill', null, { sessionId });
  }

  async onTerminalOutput(handler: (event: TerminalOutputEvent) => void): Promise<() => void> {
    if (!this.capabilities.terminal) return () => undefined;
    try {
      const unlisten = await listen<TerminalOutputEvent>(TERMINAL_OUTPUT_EVENT, (event) =>
        handler(event.payload),
      );
      return unlisten;
    } catch {
      return () => undefined;
    }
  }

  async onTerminalExit(handler: (event: TerminalExitEvent) => void): Promise<() => void> {
    if (!this.capabilities.terminal) return () => undefined;
    try {
      const unlisten = await listen<TerminalExitEvent>(TERMINAL_EXIT_EVENT, (event) =>
        handler(event.payload),
      );
      return unlisten;
    } catch {
      return () => undefined;
    }
  }

  // ── Sistema de ficheiros real ────────────────────────────────────────────

  async pickFilesRoot(): Promise<string | null> {
    if (!this.capabilities.realFilesystem) return null;
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      return typeof selected === 'string' ? selected : null;
    } catch {
      return null;
    }
  }

  async filesSetRoot(path: string): Promise<RealFilesRoot | null> {
    if (!this.capabilities.realFilesystem) return null;
    return this.tryInvoke<RealFilesRoot>('files_set_root', null, { path });
  }

  async filesReadDir(path: string | null): Promise<readonly RealFileEntry[] | null> {
    if (!this.capabilities.realFilesystem) return null;
    return this.tryInvoke<RealFileEntry[]>('files_read_dir', null, { path });
  }

  // ── Auxiliar ─────────────────────────────────────────────────────────────

  /**
   * Chama um comando do Rust e devolve `fallback` se falhar.
   *
   * É aqui que a promessa de "nunca crashar por causa de uma funcionalidade em
   * falta" se cumpre: um comando ausente ou recusado vira um valor neutro.
   */
  protected async tryInvoke<T>(
    command: string,
    fallback: T | null,
    args?: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      console.warn(`[platform] o comando "${command}" falhou:`, error);
      return fallback;
    }
  }
}
