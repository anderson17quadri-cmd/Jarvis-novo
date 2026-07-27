import { useCallback, useEffect } from 'react';

import { AICore } from '@/components/ai-core/AICore';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { BootSequence } from '@/components/boot/BootSequence';
import { AppShell } from '@/components/shell/AppShell';
import { CustomCursor } from '@/components/shell/CustomCursor';
import { Wallpaper } from '@/components/shell/Wallpaper';
import { WindowManager } from '@/components/windows/WindowManager';
import { useAppLauncher } from '@/hooks/use-app-launcher';
import { useEntranceCascade } from '@/hooks/use-entrance-cascade';
import { initializePlatform } from '@/platform';
import { notificationService } from '@/services/notification-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWindowStore } from '@/stores/use-window-store';

/**
 * Raiz da aplicação.
 *
 * Orquestra as três fases — arranque, login e desktop — e mais nada. Cada fase
 * é um componente que só sabe da sua parte e avisa quando termina.
 */
export function App(): React.JSX.Element {
  const phase = useSessionStore((state) => state.phase);
  const completeBoot = useSessionStore((state) => state.completeBoot);
  const authenticate = useSessionStore((state) => state.authenticate);
  const logout = useSessionStore((state) => state.logout);

  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const mode = useAssistantStore((state) => state.mode);
  const pulseCount = useAssistantStore((state) => state.pulseCount);
  const pulse = useAssistantStore((state) => state.pulse);
  const setMode = useAssistantStore((state) => state.setMode);

  const isDesktop = phase === 'desktop';
  const cascade = useEntranceCascade(isDesktop);
  const { launch, restoreSavedLayout } = useAppLauncher();
  const openWindowCount = useWindowStore((state) => state.windows.length);

  useEffect(() => {
    void initializePlatform().then(() => hydrateTheme());
  }, [hydrateTheme]);

  useEffect(() => {
    if (!isDesktop) return;

    notificationService.success(
      'Ambiente carregado',
      'Todos os módulos responderam dentro do tempo esperado.',
    );
    void restoreSavedLayout();
  }, [isDesktop, restoreSavedLayout]);

  // Provisório até ao bloco 7, onde a voz assume o controlo do modo.
  const handleActivateCore = useCallback((): void => {
    const order = ['idle', 'listening', 'thinking', 'speaking', 'error'] as const;
    const current = useAssistantStore.getState().mode;
    pulse();
    setMode(order[(order.indexOf(current) + 1) % order.length] ?? 'idle');
  }, [pulse, setMode]);

  const handleOpenPalette = useCallback((): void => {
    notificationService.info('Command palette', 'Entra no bloco 7.');
  }, []);

  return (
    <>
      <Wallpaper />
      <CustomCursor />

      {phase === 'booting' && <BootSequence onComplete={completeBoot} />}
      {phase === 'login' && <LoginScreen onAuthenticated={authenticate} />}

      <AppShell
        isActive={isDesktop}
        onLaunchApp={launch}
        onOpenPalette={handleOpenPalette}
        onToggleMicrophone={handleActivateCore}
        onOpenNotifications={() =>
          notificationService.success(
            'Automação concluída',
            'Prospecção de 18 empresas terminada. Landing pages prontas para revisão.',
          )
        }
        onLogout={logout}
      >
        <AICore
          mode={mode}
          pulseCount={pulseCount}
          isVisible={cascade.core}
          isStateVisible={cascade.coreState}
          // O núcleo recolhe quando há janelas abertas, para não competir com elas.
          isShrunk={openWindowCount > 0}
          onActivate={handleActivateCore}
        />
      </AppShell>

      {isDesktop && <WindowManager />}
    </>
  );
}
