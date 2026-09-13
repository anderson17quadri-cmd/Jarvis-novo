import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { load, type Store } from '@tauri-apps/plugin-store';
import { arch as osArch, platform as osPlatform, version as osVersion } from '@tauri-apps/plugin-os';

import type { PlatformAdapter } from './platform-adapter';
import type { PlatformCapabilities, PlatformInfo, PlatformKind } from '@/types/platform';
import type { ScreenRect } from '@/types/screen-zone';
import type { RealFileEntry, RealFilesRoot } from '@/types/real-file-entry';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';
import type { TerminalExitEvent, TerminalOutputEvent } from '@/types/terminal';
import type { MusicFileEntry } from '@/types/music';
import type { ObsidianNote, RealObsidianRoot } from '@/types/obsidian';
import type { WebPageContent } from '@/types/web-page';
import type { OllamaPullEvent } from '@/types/ollama-pull';
import type {
  ImapMessageDto,
  MailFetchParams,
  MailSendParams,
  MailSetFlagParams,
} from '@/types/mail';
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
const NETWORK_EVENT = 'automation://network-changed';

/** Progresso do descarregamento automático do modelo Ollama por omissão. */
const OLLAMA_PULL_EVENT = 'ollama://pull';

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

  // ── Controlo direto (Fase 3.2) ──────────────────────────────────────────

  async openPath(path: string): Promise<boolean> {
    if (!this.capabilities.directControl) return false;
    try {
      await invoke('open_path', { path });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "open_path" falhou:', error);
      return false;
    }
  }

  // ── Controlo direto (Fases 3.3–3.4) ──────────────────────────────────────

  async captureScreen(zones: readonly ScreenRect[]): Promise<string | null> {
    if (!this.capabilities.directControl) return null;
    // O Rust já tapa as zonas antes de devolver o PNG — a interface só vê a
    // versão tapada, nunca o print por descoberto.
    return this.tryInvoke<string>('capture_screen', null, { zones });
  }

  async moveMouseTo(x: number, y: number): Promise<boolean> {
    if (!this.capabilities.directControl) return false;
    try {
      await invoke('move_mouse_to', { x, y });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "move_mouse_to" falhou:', error);
      return false;
    }
  }

  async clickAt(x: number, y: number): Promise<boolean> {
    if (!this.capabilities.directControl) return false;
    try {
      await invoke('click_at', { x, y });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "click_at" falhou:', error);
      return false;
    }
  }

  async typeText(text: string): Promise<boolean> {
    if (!this.capabilities.directControl) return false;
    try {
      await invoke('type_text', { text });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "type_text" falhou:', error);
      return false;
    }
  }

  // ── Cofre de segredos ────────────────────────────────────────────────────

  /**
   * `secret_set`/`secret_delete` devolvem `Result<()>` do lado Rust — e `()`
   * serializa para `null` em JSON, o mesmo valor que `tryInvoke` usava como
   * `fallback` de erro. Comparar `result !== null` nunca distinguia sucesso
   * de falha, porque os dois caíam no mesmo `null` — um bug real, apanhado
   * ao construir a Peça 17 (Obsidian) e corrigido aqui também, já que o
   * cofre de segredos e o WebAuthn (Peça 15) dependem deste valor de
   * retorno para saber se algo ficou mesmo guardado. Chamar `invoke`
   * diretamente e distinguir por não ter lançado, em vez de pelo valor
   * devolvido, remove a ambiguidade nas duas.
   */
  async secretSet(key: string, value: string): Promise<boolean> {
    if (!this.capabilities.secretVault) return false;
    try {
      await invoke('secret_set', { key, value });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "secret_set" falhou:', error);
      return false;
    }
  }

  async secretGet(key: string): Promise<string | null> {
    if (!this.capabilities.secretVault) return null;
    return this.tryInvoke<string | null>('secret_get', null, { key });
  }

  async secretDelete(key: string): Promise<boolean> {
    if (!this.capabilities.secretVault) return false;
    try {
      await invoke('secret_delete', { key });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "secret_delete" falhou:', error);
      return false;
    }
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

  async getNetworkState(): Promise<{
    is_connected: boolean;
    connection_type: string;
    ipv4_address: string | null;
    interface_name: string;
    is_metered: boolean;
  } | null> {
    if (!this.capabilities.networkMonitor) return null;
    return this.tryInvoke<{
      is_connected: boolean;
      connection_type: string;
      ipv4_address: string | null;
      interface_name: string;
      is_metered: boolean;
    }>('get_network_state', null);
  }

  async watchNetwork(): Promise<string | null> {
    if (!this.capabilities.networkMonitor) return null;
    return this.tryInvoke<string>('watch_network', null);
  }

  async unwatchNetwork(): Promise<void> {
    if (!this.capabilities.networkMonitor) return;
    await this.tryInvoke('unwatch_network', null);
  }

  async onNetworkChanged(
    handler: (event: {
      is_connected: boolean;
      connection_type: string;
      ipv4_address: string | null;
      interface_name: string;
      is_metered: boolean;
    }) => void,
  ): Promise<() => void> {
    if (!this.capabilities.networkMonitor) return () => undefined;
    try {
      const unlisten = await listen<{
        is_connected: boolean;
        connection_type: string;
        ipv4_address: string | null;
        interface_name: string;
        is_metered: boolean;
      }>(NETWORK_EVENT, (event) => handler(event.payload));
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

  // ── Correio real ─────────────────────────────────────────────────────────

  /**
   * Os comandos de correio usam `invoke` a sério e **propagam** o erro, em vez
   * de caírem num valor neutro via `tryInvoke`: aqui a interface precisa de
   * distinguir "sem mensagens" de "não conseguiu ligar" (palavra-passe errada,
   * servidor em baixo). Onde `capabilities.mail` é `false` (Android), os
   * comandos nem existem do lado Rust — devolve-se vazio sem tentar o IPC.
   */
  async mailFetch(params: MailFetchParams): Promise<readonly ImapMessageDto[]> {
    if (!this.capabilities.mail) return [];
    return invoke<ImapMessageDto[]>('mail_fetch', {
      imapServer: params.imapServer,
      imapPort: params.imapPort,
      username: params.username,
      password: params.password,
      limit: params.limit,
    });
  }

  async mailSetFlag(params: MailSetFlagParams): Promise<void> {
    if (!this.capabilities.mail) return;
    await invoke('mail_set_flag', {
      imapServer: params.imapServer,
      imapPort: params.imapPort,
      username: params.username,
      password: params.password,
      messageId: params.messageId,
      flag: params.flag,
      value: params.value,
    });
  }

  async mailSend(params: MailSendParams): Promise<void> {
    if (!this.capabilities.mail) return;
    await invoke('mail_send', {
      smtpServer: params.smtpServer,
      smtpPort: params.smtpPort,
      username: params.username,
      password: params.password,
      from: params.from,
      to: params.to,
      subject: params.subject,
      body: params.body,
    });
  }

  // ── Música local ─────────────────────────────────────────────────────────

  async musicSetRoot(path: string): Promise<RealFilesRoot | null> {
    if (!this.capabilities.music) return null;
    return this.tryInvoke<RealFilesRoot>('music_set_root', null, { path });
  }

  async musicReadDir(): Promise<readonly MusicFileEntry[]> {
    if (!this.capabilities.music) return [];
    const result = await this.tryInvoke<MusicFileEntry[]>('music_read_dir', null);
    return result ?? [];
  }

  toLocalMediaUrl(path: string): string {
    if (!this.capabilities.music) return '';
    try {
      return convertFileSrc(path);
    } catch {
      return '';
    }
  }

  // ── Vault Obsidian ───────────────────────────────────────────────────────

  async obsidianSetRoot(path: string): Promise<RealObsidianRoot | null> {
    if (!this.capabilities.obsidian) return null;
    return this.tryInvoke<RealObsidianRoot>('obsidian_set_root', null, { path });
  }

  async obsidianListNotes(): Promise<readonly ObsidianNote[]> {
    if (!this.capabilities.obsidian) return [];
    const result = await this.tryInvoke<ObsidianNote[]>('obsidian_list_notes', null);
    return result ?? [];
  }

  async obsidianReadNote(path: string): Promise<string | null> {
    if (!this.capabilities.obsidian) return null;
    return this.tryInvoke<string>('obsidian_read_note', null, { path });
  }

  async obsidianWriteNote(path: string, content: string): Promise<boolean> {
    if (!this.capabilities.obsidian) return false;
    try {
      await invoke('obsidian_write_note', { path, content });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "obsidian_write_note" falhou:', error);
      return false;
    }
  }

  // ── Navegador controlado pelo assistente ────────────────────────────────

  async fetchPageText(url: string): Promise<WebPageContent | null> {
    if (!this.capabilities.webBrowsing) return null;
    return this.tryInvoke<WebPageContent>('fetch_page_text', null, { url });
  }

  // ── Voz clonada local ────────────────────────────────────────────────────

  /**
   * O comando `reiniciar_voz_clonada` só existe no desktop (o módulo
   * `voice_clone` é `#[cfg(desktop)]`). No Android o `invoke` falha por o
   * comando não existir, e cai aqui em `false` — a degradação de sempre.
   */
  async restartVoiceService(): Promise<boolean> {
    try {
      await invoke('reiniciar_voz_clonada');
      return true;
    } catch (error) {
      console.warn('[platform] o comando "reiniciar_voz_clonada" falhou:', error);
      return false;
    }
  }

  async startWakeWord(word: string): Promise<boolean> {
    try {
      await invoke('iniciar_wake_word', { palavra: word });
      return true;
    } catch (error) {
      console.warn('[platform] o comando "iniciar_wake_word" falhou:', error);
      return false;
    }
  }

  async stopWakeWord(): Promise<void> {
    try {
      await invoke('parar_wake_word');
    } catch (error) {
      console.warn('[platform] o comando "parar_wake_word" falhou:', error);
    }
  }

  async onOllamaPull(handler: (event: OllamaPullEvent) => void): Promise<() => void> {
    try {
      const unlisten = await listen<OllamaPullEvent>(OLLAMA_PULL_EVENT, (event) =>
        handler(event.payload),
      );
      return unlisten;
    } catch {
      return () => undefined;
    }
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
