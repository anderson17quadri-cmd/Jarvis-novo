import { useCallback, useEffect } from 'react';

import { AICore } from '@/components/ai-core/AICore';
import { AppShell } from '@/components/shell/AppShell';
import { CustomCursor } from '@/components/shell/CustomCursor';
import { Wallpaper } from '@/components/shell/Wallpaper';
import { initializePlatform } from '@/platform';
import { notificationService } from '@/services/notification-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useThemeStore } from '@/stores/use-theme-store';
import type { AppId } from '@/types/app';

/**
 * Raiz da aplicação.
 *
 * Bloco 3: o shell já está de pé e é responsivo. O núcleo, o arranque, o login,
 * as janelas e a paleta entram nos blocos seguintes.
 */
export function App(): React.JSX.Element {
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const mode = useAssistantStore((state) => state.mode);
  const pulseCount = useAssistantStore((state) => state.pulseCount);
  const pulse = useAssistantStore((state) => state.pulse);
  const setMode = useAssistantStore((state) => state.setMode);

  useEffect(() => {
    void initializePlatform().then(() => hydrateTheme());
  }, [hydrateTheme]);

  // Provisório até ao bloco 7: percorre os modos para se ver o núcleo em cada um.
  const handleActivateCore = useCallback((): void => {
    const order = ['idle', 'listening', 'thinking', 'speaking', 'error'] as const;
    const current = useAssistantStore.getState().mode;
    const next = order[(order.indexOf(current) + 1) % order.length] ?? 'idle';
    pulse();
    setMode(next);
  }, [pulse, setMode]);

  const handleLaunchApp = useCallback((appId: AppId): void => {
    notificationService.info('Janela', `"${appId}" abre no bloco do WindowManager.`);
  }, []);

  const handleOpenPalette = useCallback((): void => {
    notificationService.info('Command palette', 'Entra no bloco 7.');
  }, []);

  return (
    <>
      <Wallpaper />
      <CustomCursor />

      <AppShell
        isActive
        onLaunchApp={handleLaunchApp}
        onOpenPalette={handleOpenPalette}
        onToggleMicrophone={() => undefined}
        onOpenNotifications={() => undefined}
        onLogout={() => undefined}
      >
        <AICore
          mode={mode}
          pulseCount={pulseCount}
          isVisible
          isStateVisible
          isShrunk={false}
          onActivate={handleActivateCore}
        />
      </AppShell>
    </>
  );
}
