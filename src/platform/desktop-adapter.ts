import { TauriAdapterBase } from './tauri-adapter-base';
import type { PlatformCapabilities, PlatformKind } from '@/types/platform';

/**
 * Windows (e qualquer desktop). A experiência principal: tudo ligado.
 */
export class DesktopAdapter extends TauriAdapterBase {
  protected readonly kind: PlatformKind = 'desktop';

  readonly capabilities: PlatformCapabilities = {
    systemMetrics: true,
    processList: true,
    systemTray: true,
    globalShortcut: true,
    windowManagement: true,
    nativeNotifications: true,
    shellOpen: true,
    fileDialogs: true,
    nativeStorage: true,
    voice: true,
    // Windows Hello a sério (windows_hello_available/_verify no Rust). Fora
    // do Windows os comandos devolvem "indisponível" em vez de não
    // compilar — checkBiometricAvailability() é quem confirma em runtime se
    // esta máquina concreta tem sensor ou PIN configurado.
    biometrics: true,
    // PTY a sério via `portable-pty` — só existe no desktop.
    terminal: true,
    secretVault: true,
    // Gatilhos nativos para automações (Parte 13).
    fileWatcher: true,
    usbMonitor: true,
    batteryMonitor: true,
    // `std::fs` a sério, atrás de uma pasta-raiz declarada — ver
    // commands/files.rs (files_set_root/files_read_dir).
    realFilesystem: true,
    // Correio real (IMAP/SMTP) — ver commands/mail.rs.
    mail: true,
    // Música local (pasta + `<audio>` real) — ver commands/music.rs.
    music: true,
    obsidian: true,
  };
}
