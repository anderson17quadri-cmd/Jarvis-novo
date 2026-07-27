import { useCallback, useEffect, useMemo, useState } from 'react';

import { AICore } from '@/components/ai-core/AICore';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { BootSequence } from '@/components/boot/BootSequence';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { DesktopContextMenu } from '@/components/context-menu/DesktopContextMenu';
import { ToastViewport } from '@/components/notifications/ToastViewport';
import { AppShell } from '@/components/shell/AppShell';
import { CustomCursor } from '@/components/shell/CustomCursor';
import { Wallpaper } from '@/components/shell/Wallpaper';
import { WindowManager } from '@/components/windows/WindowManager';
import { useAppLauncher } from '@/hooks/use-app-launcher';
import { useEntranceCascade } from '@/hooks/use-entrance-cascade';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useVoice } from '@/hooks/use-voice';
import { getPlatformAdapter, initializePlatform } from '@/platform';
import { notificationService } from '@/services/notification-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWindowStore } from '@/stores/use-window-store';
import type { CommandActions } from '@/components/command-palette/command-registry';

/**
 * Raiz da aplicação.
 *
 * Orquestra as três fases — arranque, login e desktop — e liga as peças umas às
 * outras. Não contém lógica de negócio: cada serviço trata da sua.
 */
export function App(): React.JSX.Element {
  const phase = useSessionStore((state) => state.phase);
  const completeBoot = useSessionStore((state) => state.completeBoot);
  const authenticate = useSessionStore((state) => state.authenticate);
  const logout = useSessionStore((state) => state.logout);
  const resetBootFlag = useSessionStore((state) => state.resetBootFlag);

  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const setTheme = useThemeStore((state) => state.setTheme);

  const mode = useAssistantStore((state) => state.mode);
  const pulseCount = useAssistantStore((state) => state.pulseCount);

  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const isDesktop = phase === 'desktop';

  const cascade = useEntranceCascade(isDesktop);
  const { launch, restoreSavedLayout } = useAppLauncher();
  const openWindowCount = useWindowStore((state) => state.windows.length);
  const { toggleListening } = useVoice({ onLaunchApp: launch });

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

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true }, openPalette, isDesktop);

  /**
   * Atalho global do sistema (CTRL+ALT+J no desktop).
   *
   * O adapter devolve uma função de cancelamento válida mesmo onde não há
   * atalhos globais — não é preciso verificar a plataforma aqui.
   */
  useEffect(() => {
    if (!isDesktop) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void getPlatformAdapter()
      .onGlobalInvoke(() => {
        openPalette();
      })
      .then((off) => {
        if (cancelled) off();
        else unsubscribe = off;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isDesktop, openPalette]);

  const commandActions = useMemo<CommandActions>(
    () => ({
      launchApp: launch,
      setTheme,
      toggleMicrophone: toggleListening,
      restartBootSequence: () => {
        void resetBootFlag().then(() => window.location.reload());
      },
    }),
    [launch, resetBootFlag, setTheme, toggleListening],
  );

  return (
    <>
      <Wallpaper />
      <CustomCursor />

      {phase === 'booting' && <BootSequence onComplete={completeBoot} />}
      {phase === 'login' && <LoginScreen onAuthenticated={authenticate} />}

      <AppShell
        isActive={isDesktop}
        onLaunchApp={launch}
        onOpenPalette={openPalette}
        onToggleMicrophone={toggleListening}
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
          onActivate={toggleListening}
        />
      </AppShell>

      {isDesktop && <WindowManager />}

      <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} actions={commandActions} />

      <DesktopContextMenu
        isEnabled={isDesktop && !isPaletteOpen}
        handlers={{ launchApp: launch, openPalette }}
      />

      <ToastViewport />
    </>
  );
}
