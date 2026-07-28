import { create } from 'zustand';

import { DEFAULT_THEME, type ThemeId } from '@/design-system/tokens';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { themeService } from '@/services/theme-service';

interface ThemeState {
  theme: ThemeId;
  /** Muda de tema, aplica no DOM e persiste. */
  setTheme: (theme: ThemeId) => void;
  /** Lê o tema guardado no arranque. */
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,

  setTheme: (theme) => {
    themeService.apply(theme);
    void themeService.save(theme);
    set({ theme });
    eventBus.emit('tema:alterado', { theme });
    // Fica na auditoria venha de onde vier: paleta, voz ou automação.
    logService.audit(`Aplicar o tema ${theme}`, 'executado');
  },

  hydrate: async () => {
    const theme = await themeService.load();
    themeService.apply(theme);
    set({ theme });
  },
}));
