import { useCallback, useEffect } from 'react';

import { AppShell } from '@/components/shell/AppShell';
import { CustomCursor } from '@/components/shell/CustomCursor';
import { Wallpaper } from '@/components/shell/Wallpaper';
import { initializePlatform } from '@/platform';
import { notificationService } from '@/services/notification-service';
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

  useEffect(() => {
    void initializePlatform().then(() => hydrateTheme());
  }, [hydrateTheme]);

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
        <div className="text-center">
          <h1 className="pl-[0.42em] text-h2 tracking-[0.42em]">JARVIS</h1>
          <p className="mt-s2 text-desc text-t2">O núcleo entra no bloco 4.</p>
        </div>
      </AppShell>
    </>
  );
}
