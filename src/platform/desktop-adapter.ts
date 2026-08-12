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
    // Biometria real exigiria Windows Hello; por agora é simulada no login.
    biometrics: false,
    secretVault: true,
  };
}
