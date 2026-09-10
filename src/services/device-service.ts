import { getPlatformAdapter, initializePlatform } from '@/platform';
import type { PlatformInfo } from '@/types/platform';

/**
 * Informação do dispositivo (Parte 3 §Serviços).
 *
 * A plataforma resolve-se de forma assíncrona no arranque — antes disso o
 * adapter devolve uma resposta parcial. O serviço expõe as duas leituras:
 * a imediata e a completa. Sem React e sem stores — a `useDeviceStore` é que
 * guarda o resultado para a interface.
 */
export class DeviceService {
  /** A informação conhecida neste instante — parcial antes da inicialização. */
  getInfo(): PlatformInfo {
    return getPlatformAdapter().info;
  }

  /** Espera pela inicialização da plataforma e devolve a informação completa. */
  async resolveInfo(): Promise<PlatformInfo> {
    const adapter = await initializePlatform();
    return adapter.info;
  }
}

export const deviceService = new DeviceService();
