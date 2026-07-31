import { create } from 'zustand';

import { DEFAULT_THEME, type ThemeId } from '@/design-system/tokens';
import { isCustomThemeId } from '@/types/custom-theme';
import { useCustomThemeStore } from './use-custom-theme-store';
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
    // O tema personalizado vem daqui, e não de dentro do serviço: assim o
    // `themeService` continua sem conhecer store nenhuma.
    themeService.apply(theme, useCustomThemeStore.getState().get(theme));
    void themeService.save(theme);
    set({ theme });
    eventBus.emit('tema:alterado', { theme });
    // Fica na auditoria venha de onde vier: paleta, voz ou automação.
    logService.audit(`Aplicar o tema ${theme}`, 'executado');
  },

  hydrate: async () => {
    // Os personalizados primeiro: sem eles, um tema feito pelo utilizador
    // aplicava-se sem cores e o ecrã ficava com as do Classic.
    await useCustomThemeStore.getState().hydrate();

    const saved = await themeService.load();
    const custom = useCustomThemeStore.getState().get(saved);

    // Um tema personalizado apagado entretanto não existe mais. Voltar ao base
    // é melhor do que ficar com um identificador que não aponta para nada.
    const theme = isCustomThemeId(saved) && !custom ? DEFAULT_THEME : saved;

    themeService.apply(theme, custom);
    set({ theme });
  },
}));
