import { create } from 'zustand';

import { createId } from '@/lib/id';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import type { AppId } from '@/types/app';
import {
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  type PersistedWindowLayout,
  type WindowInstance,
  type WindowRect,
} from '@/types/window';

/** Primeiro z-index. Fica acima do dock e abaixo dos toasts. */
const BASE_Z_INDEX = 50;
/** Desvio em cascata entre janelas abertas seguidas. */
const CASCADE_STEP = 28;
const CASCADE_WRAP = 112;

interface WindowState {
  windows: readonly WindowInstance[];
  topZIndex: number;
  cascadeOffset: number;

  open: (appId: AppId, title: string, rect: WindowRect) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleMaximize: (id: string, maximizedRect: WindowRect) => void;
  move: (id: string, position: { x: number; y: number }) => void;
  resize: (id: string, size: { width: number; height: number }) => void;

  /** Guarda a geometria das janelas abertas. */
  persistLayout: () => Promise<void>;
  loadLayout: () => Promise<readonly PersistedWindowLayout[]>;
}

export const useWindowStore = create<WindowState>((set, get) => ({
  windows: [],
  topZIndex: BASE_Z_INDEX,
  cascadeOffset: 0,

  open: (appId, title, rect) => {
    // Uma aplicação já aberta ganha foco em vez de duplicar a janela.
    const existing = get().windows.find((window) => window.appId === appId);
    if (existing) {
      get().focus(existing.id);
      get().restore(existing.id);
      return existing.id;
    }

    const id = createId('win');
    const zIndex = get().topZIndex + 1;
    const offset = get().cascadeOffset;

    const instance: WindowInstance = {
      id,
      appId,
      title,
      rect: { ...rect, x: rect.x + offset, y: rect.y + offset },
      zIndex,
      isMinimized: false,
      isMaximized: false,
      restoreRect: null,
    };

    set((state) => ({
      windows: [...state.windows, instance],
      topZIndex: zIndex,
      cascadeOffset: (offset + CASCADE_STEP) % CASCADE_WRAP,
    }));

    return id;
  },

  close: (id) =>
    set((state) => ({ windows: state.windows.filter((window) => window.id !== id) })),

  focus: (id) =>
    set((state) => {
      const target = state.windows.find((window) => window.id === id);
      // Já está à frente — não vale a pena gastar um z-index novo.
      if (!target || target.zIndex === state.topZIndex) return state;

      const zIndex = state.topZIndex + 1;
      return {
        windows: state.windows.map((window) =>
          window.id === id ? { ...window, zIndex } : window,
        ),
        topZIndex: zIndex,
      };
    }),

  minimize: (id) =>
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id ? { ...window, isMinimized: true } : window,
      ),
    })),

  restore: (id) =>
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id ? { ...window, isMinimized: false } : window,
      ),
    })),

  toggleMaximize: (id, maximizedRect) =>
    set((state) => ({
      windows: state.windows.map((window) => {
        if (window.id !== id) return window;

        if (window.isMaximized) {
          return {
            ...window,
            isMaximized: false,
            rect: window.restoreRect ?? window.rect,
            restoreRect: null,
          };
        }

        return {
          ...window,
          isMaximized: true,
          restoreRect: window.rect,
          rect: maximizedRect,
        };
      }),
    })),

  move: (id, position) =>
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id ? { ...window, rect: { ...window.rect, ...position } } : window,
      ),
    })),

  resize: (id, size) =>
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id
          ? {
              ...window,
              rect: {
                ...window.rect,
                width: Math.max(WINDOW_MIN_WIDTH, size.width),
                height: Math.max(WINDOW_MIN_HEIGHT, size.height),
              },
            }
          : window,
      ),
    })),

  persistLayout: async () => {
    const layout: PersistedWindowLayout[] = get().windows.map((window) => ({
      appId: window.appId,
      // Guardar a geometria restaurada, não a maximizada: reabrir maximizado
      // com o tamanho do ecrã anterior daria uma janela fora do sítio.
      rect: window.restoreRect ?? window.rect,
      isMaximized: window.isMaximized,
    }));

    await storageService.set(STORAGE_KEYS.windowLayout, layout);
  },

  loadLayout: async () => {
    return storageService.get<PersistedWindowLayout[]>(STORAGE_KEYS.windowLayout, []);
  },
}));

/** Aplicações com janela aberta — o dock usa isto para o ponto de "em execução". */
export function selectOpenAppIds(state: WindowState): readonly AppId[] {
  return state.windows.map((window) => window.appId);
}
