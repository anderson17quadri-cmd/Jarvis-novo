import { TauriAdapterBase } from './tauri-adapter-base';
import type { PlatformCapabilities, PlatformKind } from '@/types/platform';
import type { ProcessInfo } from '@/types/system';

/**
 * Android — subconjunto suportado no telemóvel.
 *
 * O que falta não é escondido com um `if` na interface: fica desligado nas
 * capacidades, e os métodos correspondentes devolvem vazio. A interface lê as
 * capacidades e adapta-se sozinha.
 */
export class AndroidAdapter extends TauriAdapterBase {
  protected readonly kind: PlatformKind = 'android';

  readonly capabilities: PlatformCapabilities = {
    // CPU, memória, disco e rede leem-se na mesma — é o próprio processo.
    systemMetrics: true,
    // O Android isola as aplicações: não há acesso aos processos das outras.
    processList: false,
    // Não existe bandeja no Android.
    systemTray: false,
    // Nem atalhos de teclado globais.
    globalShortcut: false,
    // A aplicação ocupa o ecrã todo; quem gere a janela é o sistema.
    windowManagement: false,
    nativeNotifications: true,
    shellOpen: true,
    fileDialogs: true,
    nativeStorage: true,
    voice: true,
    biometrics: false,
    secretVault: false,
  };

  /** Nem chega a tocar no IPC — não há nada para pedir. */
  override async getTopProcesses(): Promise<readonly ProcessInfo[]> {
    return [];
  }
}
