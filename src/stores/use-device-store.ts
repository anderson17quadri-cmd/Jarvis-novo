import { create } from 'zustand';

import { deviceService } from '@/services/device-service';
import type { PlatformInfo } from '@/types/platform';

/**
 * Informação do dispositivo (Parte 3 §Serviços).
 *
 * A plataforma só fica resolvida depois de `initializePlatform` acabar, e a
 * interface monta antes disso. A store guarda a informação e atualiza-se
 * quando ela chega — os componentes que montaram cedo recebem a versão
 * completa sem fazer nada.
 */

interface DeviceState {
  readonly info: PlatformInfo;
  /** Espera pela resolução da plataforma e guarda a informação completa. */
  readonly hydrate: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  info: deviceService.getInfo(),

  hydrate: async () => {
    set({ info: await deviceService.resolveInfo() });
  },
}));
