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
import { USER_FIRST_NAME } from '@/constants/user';
import { seedAutomations } from '@/data/automations';
import { aiService } from '@/services/ai-service';
import { setContextSource } from '@/services/assistant/context';
import { memoryService } from '@/services/assistant/memory-service';
import { automationService } from '@/services/automation-service';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { mailService } from '@/services/mail/mail-service';
import { notificationService } from '@/services/notification-service';
import { musicService } from '@/services/music/music-service';
import { soundService } from '@/services/sound-service';
import { weatherService } from '@/services/weather/weather-service';
import { setVoiceExecutor } from '@/services/voice/executor';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { useTaskStore } from '@/stores/use-task-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import type { CommandActions } from '@/components/command-palette/command-registry';
import type { AppId } from '@/types/app';
import type { SystemStateId } from '@/types/system-state';
import type { ThemeId } from '@/design-system/tokens';
import { WEATHER_LABELS } from '@/types/weather';
import type { WidgetId } from '@/types/widget';

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
  /** Texto com que a paleta abre — usado pelo comando de voz "procura…". */
  const [paletteQuery, setPaletteQuery] = useState('');
  const isDesktop = phase === 'desktop';

  const cascade = useEntranceCascade(isDesktop);
  const { launch, restoreSavedLayout } = useAppLauncher();
  const openWindowCount = useWindowStore((state) => state.windows.length);
  const { toggleListening, speak } = useVoice();

  // O email passa a produzir notificações assim que o desktop está de pé.
  useNotificationSources(isDesktop);

  useEffect(() => {
    // O registo escuta o Event Bus a partir daqui — é o inspetor de eventos
    // do Centro de programador, sem mecanismo novo nenhum.
    const stopWatching = logService.watchEventBus();
    logService.log('info', 'sistema', 'Interface a arrancar');

    void initializePlatform().then(async () => {
      await hydrateTheme();
      await useNotificationStore.getState().hydrate();
      // A grelha só monta quando há widgets — hidratar lá dentro nunca
      // chegaria a correr na primeira vez.
      await useWidgetStore.getState().hydrate();
      await usePluginStore.getState().hydrate();
      await useSystemStateStore.getState().hydrate();
      await useAppearanceStore.getState().hydrate();
      await soundService.hydrate();
      await automationService.hydrate(seedAutomations());
      await useAssistantStore.getState().hydrate();
      await memoryService.hydrate();

      const adapter = getPlatformAdapter();
      logService.log(
        'info',
        'plataforma',
        `Plataforma pronta: ${adapter.info.kind}`,
        adapter.info.osName ?? undefined,
      );
    });

    return stopWatching;
  }, [hydrateTheme]);

  /**
   * Motor de automações.
   *
   * O executor é injetado daqui, como as ações da paleta: sem isto o motor
   * acabaria a conhecer o WindowManager, os temas e a voz.
   */
  useEffect(() => {
    if (!isDesktop) return;

    return automationService.start(
      {
        openWindow: (appId) => launch(appId as AppId),
        notify: (title, description) => notificationService.info(title, description, {
          category: 'automacao',
        }),
        setTheme: (theme) => setTheme(theme as ThemeId),
        setSystemState: (state) => {
          useSystemStateStore.getState().set(state as SystemStateId);
          void useSystemStateStore.getState().persist();
        },
        setWidgetVisible: (widget, show) => {
          const store = useWidgetStore.getState();
          if (show) store.show(widget as WidgetId);
          else store.hide(widget as WidgetId);
          void store.persist();
        },
        speak,
      },
      () => ({ now: new Date(), systemState: useSystemStateStore.getState().current }),
    );
  }, [isDesktop, launch, setTheme, speak]);

  useEffect(() => {
    if (!isDesktop) return;

    void restoreSavedLayout();

    // A IA cumprimenta depois de a cascata de entrada terminar (Parte 5
    // §Transição). Antes disso, falaria por cima de um ecrã ainda a montar.
    const timer = setTimeout(() => {
      // O bus anuncia o facto; quem quiser reagir, reage. O motor de
      // automações é o primeiro cliente.
      eventBus.emit('desktop:carregado', {});
      speak(DESKTOP_GREETING);
      notificationService.success(
        'Ambiente carregado',
        'Todos os módulos responderam dentro do tempo esperado.',
      );
    }, DESKTOP_GREETING_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isDesktop, restoreSavedLayout, speak]);

  /**
   * Contexto do assistente (Parte 7.2).
   *
   * Montado aqui porque é aqui que se conhecem as stores todas. O serviço
   * recebe uma função e chama-a — pelas mesmas razões do executor das
   * automações e do de voz.
   */
  useEffect(() => {
    return setContextSource(() => {
      const weather = weatherService.current;

      return {
        now: new Date(),
        userName: USER_FIRST_NAME,
        weather: weather
          ? {
              location: weather.location,
              temperatureC: Math.round(weather.now.temperatureC),
              label: WEATHER_LABELS[weather.now.condition],
            }
          : null,
        openWindows: useWindowStore.getState().windows.map((window) => window.title),
        unreadNotifications: useNotificationStore
          .getState()
          .notifications.filter((notification) => !notification.isRead).length,
        systemState: useSystemStateStore.getState().definition.name.toLowerCase(),
        theme: useThemeStore.getState().theme,
      };
    });
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    // A pesquisa por voz vale para uma abertura só.
    setPaletteQuery('');
  }, []);

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true }, openPalette, isDesktop);

  /**
   * Comandos de voz (Parte 10).
   *
   * O interpretador é uma função pura sobre strings; isto é o que os
   * transforma em ações. Mesma injeção das automações e da paleta.
   */
  useEffect(() => {
    if (!isDesktop) return;

    return setVoiceExecutor({
      openWindow: (appId) => {
        logService.audit(`Abrir a janela ${appId} por voz`, 'executado');
        launch(appId);
      },
      closeAllWindows: () => {
        const store = useWindowStore.getState();
        logService.audit(`Fechar ${store.windows.length} janelas por voz`, 'executado');
        for (const window of [...store.windows]) store.close(window.id);
        void store.persistLayout();
      },
      setTheme,
      setSystemState: (state) => {
        useSystemStateStore.getState().set(state);
        void useSystemStateStore.getState().persist();
      },
      setWidgetVisible: (widget, show) => {
        const store = useWidgetStore.getState();
        if (show) store.show(widget);
        else store.hide(widget);
        void store.persist();
      },
      hideAllWidgets: () => {
        const store = useWidgetStore.getState();
        for (const widget of store.widgets) store.hide(widget.id);
        void store.persist();
      },
      createTask: (title) => {
        useTaskStore.getState().add(title, 'media');
        void useTaskStore.getState().persist();
        launch('tasks');
      },
      search: (query) => {
        setPaletteQuery(query);
        openPalette();
      },
      music: (action) => {
        if (action === 'proxima') void musicService.next();
        else if (action === 'anterior') void musicService.previous();
        else void musicService.togglePlay();
      },
      restartInterface: () => void restartBootSequence(),
      ask: (text) => {
        launch('assistant');
        void aiService.send(text).then((reply) => {
          if (reply.length > 0) speak(reply);
        });
      },
    });
  }, [isDesktop, launch, openPalette, restartBootSequence, setTheme, speak]);


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
      openNotifications: () => useNotificationStore.getState().setPanelOpen(true),
      openExternal: (url) => void getPlatformAdapter().openExternal(url),
      markMailRead: (messageId) => void mailService.markRead(messageId),
      setSystemState: (stateId) => {
        useSystemStateStore.getState().set(stateId);
        void useSystemStateStore.getState().persist();

        const definition = useSystemStateStore.getState().definition;
        notificationService.info(`Modo ${definition.name}`, definition.description);
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

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={closePalette}
        actions={commandActions}
        initialQuery={paletteQuery}
      />

      <DesktopContextMenu
        isEnabled={isDesktop && !isPaletteOpen}
        handlers={{ launchApp: launch, openPalette }}
      />

      <ToastViewport />
      <NotificationPanel />
    </>
  );
}
