import { create } from 'zustand';

import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import type { ScreenRect } from '@/types/screen-zone';

/**
 * Zonas sensíveis do ecrã (Fase 3.3).
 *
 * Retângulos que a pessoa desenhou em Privacidade — a barra de senhas do
 * browser, uma app de banco — e que ficam sempre tapados antes de um print sair
 * da máquina. O tapar acontece no Rust (`capture_screen` recebe as zonas e
 * devolve o PNG já tapado); esta store só guarda as medidas e persiste-as, para
 * sobreviverem a um reinício.
 *
 * Só estado e persistência, como as outras stores — não sabe que existe um
 * `capture_screen`, nem precisa de saber.
 */

/** Uma zona guardada: o retângulo, com um `id` para a interface listar e apagar. */
export interface SensitiveZone extends ScreenRect {
  readonly id: string;
}

interface SensitiveZonesState {
  zones: readonly SensitiveZone[];
  /** Acrescenta uma zona nova. Ignora retângulos vazios (largura ou altura ≤ 0). */
  add: (rect: ScreenRect) => void;
  /** Apaga uma zona pelo id. */
  remove: (id: string) => void;
  clear: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `zona-${Date.now()}-${nextId}`;
}

export const useSensitiveZonesStore = create<SensitiveZonesState>((set, get) => ({
  zones: [],

  add: (rect) => {
    // Uma zona sem área não tapa nada — recusa-se em vez de guardar ruído.
    if (rect.width <= 0 || rect.height <= 0) return;

    const zone: SensitiveZone = { id: makeId(), ...rect };
    set({ zones: [...get().zones, zone] });
    void get().persist();
  },

  remove: (id) => {
    set({ zones: get().zones.filter((zone) => zone.id !== id) });
    void get().persist();
  },

  clear: () => {
    set({ zones: [] });
    void get().persist();
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.sensitiveZones, get().zones);
  },

  hydrate: async () => {
    const saved = await storageService.get<readonly SensitiveZone[] | null>(
      STORAGE_KEYS.sensitiveZones,
      null,
    );
    if (saved && Array.isArray(saved)) {
      set({ zones: saved });
    }
  },
}));
