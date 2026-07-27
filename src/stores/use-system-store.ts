import { create } from 'zustand';

import { HISTORY_LENGTH } from '@/services/system-service';
import type { StaticSystemInfo, SystemSnapshot } from '@/types/system';

/** Ponto do histórico usado pelos gráficos do Monitor de recursos. */
export interface HistoryPoint {
  readonly at: number;
  readonly cpu: number;
  readonly memory: number;
  readonly downloadBytesPerSec: number;
  readonly uploadBytesPerSec: number;
}

interface SystemState {
  snapshot: SystemSnapshot | null;
  staticInfo: StaticSystemInfo | null;
  history: readonly HistoryPoint[];
  /** `false` quando a plataforma não sabe ler métricas — a interface esconde-as. */
  isSupported: boolean;

  setSnapshot: (snapshot: SystemSnapshot) => void;
  setStaticInfo: (info: StaticSystemInfo | null) => void;
  setSupported: (supported: boolean) => void;
  clearHistory: () => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  snapshot: null,
  staticInfo: null,
  history: [],
  isSupported: true,

  setSnapshot: (snapshot) =>
    set((state) => {
      const point: HistoryPoint = {
        at: snapshot.capturedAt,
        cpu: snapshot.cpu.usagePercent,
        memory: snapshot.memory.usagePercent,
        downloadBytesPerSec: snapshot.network.downloadBytesPerSec,
        uploadBytesPerSec: snapshot.network.uploadBytesPerSec,
      };
      // Janela deslizante: o histórico nunca cresce sem limite.
      const history = [...state.history, point].slice(-HISTORY_LENGTH);
      return { snapshot, history };
    }),

  setStaticInfo: (staticInfo) => set({ staticInfo }),
  setSupported: (isSupported) => set({ isSupported }),
  clearHistory: () => set({ history: [] }),
}));
