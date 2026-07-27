import { useCallback, useEffect, useMemo, useState } from 'react';

import { AICore } from '@/components/ai-core/AICore';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { BootSequence } from '@/components/boot/BootSequence';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { DesktopContextMenu } from '@/components/context-menu/DesktopContextMenu';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { ToastViewport } from '@/components/notifications/ToastViewport';
import { AppShell } from '@/components/shell/AppShell';
import { CustomCursor } from '@/components/shell/CustomCursor';
import { Wallpaper } from '@/components/shell/Wallpaper';
import { WindowManager } from '@/components/windows/WindowManager';
import { useAppLauncher } from '@/hooks/use-app-launcher';
import { useEntranceCascade } from '@/hooks/use-entrance-cascade';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useNotificationSources } from '@/hooks/use-notification-sources';
import { useVoice } from '@/hooks/use-voice';
import { getPlatformAdapter, initializePlatform } from '@/platform';
import { notificationService } from '@/services/notification-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import type { CommandActions } from '@/components/command-palette/command-registry';

/** Saudação da IA ao entrar no ambiente de trabalho (Parte 5 §Transição). */
const DESKTOP_GREETING = 'Bem-vindo. Todos os sistemas estão prontos.';
/** Depois da cascata de entrada terminar. */
const DESKTOP_GREETING_DELAY_MS = 1_100;

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
  const restartBootSequence = useSessionStore((state) => state.restartBootSequence);

  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const setTheme = useThemeStore((state) => state.setTheme);

  const mode = useAssistantStore((state) => state.mode);
  const pulseCount = useAssistantStore((state) => state.pulseCount);
  const burstCount = useAssistantStore((state) => state.burstCount);

  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const isDesktop = phase === 'desktop';

  const cascade = useEntranceCascade(isDesktop);
  const { launch, restoreSavedLayout } = useAppLauncher();
  const openWindowCount = useWindowStore((state) => state.windows.length);
  const { toggleListening, speak } = useVoice({ onLaunchApp: launch });

  // O email passa a produzir notificações assim que o desktop está de pé.
  useNotificationSources(isDesktop);

  useEffect(() => {
    void initializePlatform().then(async () => {
      await hydrateTheme();
      await useNotificationStore.getState().hydrate();
    });
  }, [hydrateTheme]);

  useEffect(() => {
    if (!isDesktop) return;

    void restoreSavedLayout();

    // A IA cumprimenta depois de a cascata de entrada terminar (Parte 5
    // §Transição). Antes disso, falaria por cima de um ecrã ainda a montar.
    const timer = setTimeout(() => {
      speak(DESKTOP_GREETING);
      notificationService.success(
        'Ambiente carregado',
        'Todos os módulos responderam dentro do tempo esperado.',
      );
    }, DESKTOP_GREETING_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isDesktop, restoreSavedLayout, speak]);

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
      restartBootSequence: () => void restartBootSequence(),
      toggleWidget: (widgetId) => {
        const wasVisible = useWidgetStore
          .getState()
          .widgets.find((widget) => widget.id === widgetId)?.isVisible;

        useWidgetStore.getState().toggle(widgetId);
        void useWidgetStore.getState().persist();

        // Mostrar pode falhar por falta de espaço na grelha. Silenciar isso
        // faria o comando parecer avariado.
        const isVisible = useWidgetStore
          .getState()
          .widgets.find((widget) => widget.id === widgetId)?.isVisible;

        if (!wasVisible && !isVisible) {
          notificationService.warn(
            'Sem espaço na grelha',
            'Esconda outro widget ou reduza um antes de mostrar este.',
          );
        }
      },
      resetWidgets: () => {
        useWidgetStore.getState().reset();
        void useWidgetStore.getState().persist();
        notificationService.success('Widgets', 'O arranjo predefinido foi reposto.');
      },
    }),
    [launch, restartBootSequence, setTheme, toggleListening],
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
        onOpenNotifications={() => useNotificationStore.getState().togglePanel()}
        onLogout={logout}
      >
        <AICore
          mode={mode}
          pulseCount={pulseCount}
          burstCount={burstCount}
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
      <NotificationPanel />
    </>
  );
}
