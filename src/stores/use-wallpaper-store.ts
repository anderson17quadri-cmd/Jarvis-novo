import { create } from 'zustand';

import { wallpaperService } from '@/services/wallpaper-service';
import type { RGB } from '@/components/shell/wallpaper-field';
import { eventBus } from '@/services/event-bus';

interface WallpaperState {
  /** Cor de acento atual, em RGB (o canvas não resolve variáveis CSS). */
  readonly accentColor: RGB;
  /** Força a releitura da cor de acento — chamado quando o tema muda. */
  readonly refreshAccent: () => void;
  /**
   * Liga a store aos eventos de tema. Devolve a função de cancelamento.
   * Sem isto, o wallpaper mantinha a cor do tema anterior até ser redesenhado
   * por outra razão qualquer.
   */
  readonly hydrate: () => () => void;
}

export const useWallpaperStore = create<WallpaperState>((set) => ({
  accentColor: wallpaperService.readAccentColor(),

  refreshAccent: () => {
    set({ accentColor: wallpaperService.readAccentColor() });
  },

  hydrate: () => {
    return eventBus.on('tema:alterado', () => {
      set({ accentColor: wallpaperService.readAccentColor() });
    });
  },
}));
