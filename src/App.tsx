import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AICore } from '@/components/ai-core/AICore';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { BootSequence } from '@/components/boot/BootSequence';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { DesktopContextMenu } from '@/components/context-menu/DesktopContextMenu';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { ToastViewport } from '@/components/notifications/ToastViewport';
import { AppShell } from '@/components/shell/AppShell';
import { ColourFilters } from '@/components/shell/ColourFilters';
import { VoiceCorrection } from '@/components/voice/VoiceCorrection';
import { CustomCursor } from '@/components/shell/CustomCursor';
import { Wallpaper } from '@/components/shell/Wallpaper';
import { WindowManager } from '@/components/windows/WindowManager';
import { useAppLauncher } from '@/hooks/use-app-launcher';
import { useEntranceCascade } from '@/hooks/use-entrance-cascade';
import { useIdleLock } from '@/hooks/use-idle-lock';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useAiSettings } from '@/hooks/use-ai-settings';
import { useWeatherSettings } from '@/hooks/use-weather-settings';
import { useNewsSettings } from '@/hooks/use-news-settings';
import { useWebSearchSettings } from '@/hooks/use-web-search-settings';
import { useMailSettings } from '@/hooks/use-mail-settings';
import { useMusicSettings } from '@/hooks/use-music-settings';
import { useObsidianSettings } from '@/hooks/use-obsidian-settings';
import { useNotificationSources } from '@/hooks/use-notification-sources';
import { getPluginShortcuts, pushToPlugin } from '@/plugins/runtime/plugin-bridge';
import { useVoice } from '@/hooks/use-voice';
import { useWorkspace } from '@/hooks/use-workspace';
import { getPlatformAdapter, initializePlatform } from '@/platform';
import { USER_FIRST_NAME } from '@/constants/user';
import { seedFiles } from '@/data/files';
import { themeName } from '@/lib/names';
import { searchFiles as searchFileTree } from '@/types/file-entry';
import { normalizeSearch } from '@/utils/text';
import { aiService } from '@/services/ai-service';
import { setContextSource } from '@/services/assistant/context';
import { memoryService } from '@/services/assistant/memory-service';
import { automationService } from '@/services/automation-service';
import { eventBus } from '@/services/event-bus';
import { hydrateAll } from '@/services/hydrate-all';
import { logService } from '@/services/log-service';
import { mailService } from '@/services/mail/mail-service';
import { notificationService } from '@/services/notification-service';
import { musicService } from '@/services/music/music-service';
import { obsidianService } from '@/services/knowledge/obsidian-service';
import { webSearchService } from '@/services/web-search/web-search-service';
import { openWebPage } from '@/services/knowledge/web-browser-service';
import { usePendingFileNavigationStore } from '@/stores/use-pending-file-navigation-store';
import { useWeatherStore } from '@/stores/use-weather-store';
import { setToolExecutor } from '@/services/assistant/tool-runner';
import { setVoiceExecutor } from '@/services/voice/executor';
import { extractSentences } from '@/services/voice/sentence-segmenter';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { selectPermissionDenied, usePluginStore } from '@/stores/use-plugin-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { useTaskStore } from '@/stores/use-task-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import type { CommandActions } from '@/components/command-palette/command-registry';
import type { AppId } from '@/types/app';
import type { SystemStateId } from '@/types/system-state';
import type { ThemeId } from '@/design-system/tokens';
import { WEATHER_LABELS } from '@/types/weather';
import type { WidgetId } from '@/types/widget';
import type { TaskPriority } from '@/types/task';
import type { WallpaperKind } from '@/types/appearance';
import type { DesktopId } from '@/types/workspace';

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

  // Posições para a transição do avatar (Parte 5 §Avatar "viaja").
  const [avatarFlight, setAvatarFlight] = useState<{
    readonly fromRect: DOMRect;
    readonly targetCenterX: number;
    readonly targetCenterY: number;
  } | null>(null);

  const handleAuthenticate = useCallback(
    (avatarElement: HTMLElement): void => {
      const fromRect = avatarElement.getBoundingClientRect();
      // O avatar do header está no canto superior direito, dentro de um header
      // de 72px (--h-header) com padding de 24px (--s3). O avatar tem 38px.
      const targetCenterX = window.innerWidth - 24 - 19;
      const targetCenterY = 36;
      setAvatarFlight({ fromRect, targetCenterX, targetCenterY });
      authenticate();
    },
    [authenticate],
  );

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
  const { goToDesktop, applyLayout } = useWorkspace();
  const idleLockMinutes = useAppearanceStore((state) => state.appearance.idleLockMinutes);
  const openWindowCount = useWindowStore((state) => state.windows.length);
  const { toggleListening, speak, speakQueued, limparFilaDeFala, isConversationMode, toggleConversationMode } =
    useVoice();

  // Numera os pedidos do comando "pergunta…" — um pedido novo invalida o
  // anterior, para o fim de um streaming já cancelado não falar frases que
  // ficaram para trás (item 16, revisão adversarial).
  const askGeracaoRef = useRef(0);

  // O email passa a produzir notificações assim que o desktop está de pé.
  useNotificationSources(isDesktop);

  // Aplica as preferências de IA ao serviço sempre que mudam.
  useAiSettings();

  // Aplica as preferências de meteorologia (real/simulado) ao serviço.
  useWeatherSettings();

  // Aplica as preferências de notícias (real/simulado) ao serviço.
  useNewsSettings();

  // Aplica as preferências de pesquisa web (real/simulado) ao serviço.
  useWebSearchSettings();

  // Aplica as preferências de correio (real/simulado) ao serviço.
  useMailSettings();

  // Aplica as preferências de música (local/simulado) ao serviço.
  useMusicSettings();

  // Relê a lista de notas do vault Obsidian quando a pasta escolhida muda.
  useObsidianSettings();

  useEffect(() => {
    // O registo escuta o Event Bus a partir daqui — é o inspetor de eventos
    // do Centro de programador, sem mecanismo novo nenhum.
    const stopWatching = logService.watchEventBus();
    logService.log('info', 'sistema', 'Interface a arrancar');

    void initializePlatform().then(async () => {
      // A sequência vive no `hydrate-all`, e não aqui: o restauro de uma cópia
      // de segurança precisa exatamente da mesma, e duas listas eram a maneira
      // de uma store nova entrar numa e ficar de fora da outra.
      await hydrateAll();

      const adapter = getPlatformAdapter();
      logService.log(
        'info',
        'plataforma',
        `Plataforma pronta: ${adapter.info.kind}`,
        adapter.info.osName ?? undefined,
      );
    });

    return stopWatching;
  }, []);

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
        notify: (title, description) => {
          // A permissão de notificações do plugin "Motor de automações"
          // (Parte 14 §Permissões por plugin) é a sério aqui: recusada,
          // nenhuma notificação sai — não é só um estado guardado sem efeito.
          if (selectPermissionDenied(usePluginStore.getState(), 'automations', 'notifications')) {
            logService.audit(`Notificação de automação bloqueada: "${title}"`, 'recusado');
            return;
          }
          notificationService.info(title, description, { category: 'automacao' });
        },
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

  /**
   * Gatilhos nativos das automações (Parte 13).
   *
   * Liga os eventos que o Rust emite — ficheiros, USB, bateria — ao motor.
   * Cada evento procura automações com o gatilho correspondente e dispara-as.
   */
  useEffect(() => {
    if (!isDesktop) return;

    const adapter = getPlatformAdapter();
    const cleanups: (() => void)[] = [];

    void (async () => {
      cleanups.push(
        await adapter.onFileChanged((event) => {
          automationService.checkNativeTriggers('ficheiros', { filePath: event.path });
        }),
      );
      cleanups.push(
        await adapter.onUsbChanged((event) => {
          automationService.checkNativeTriggers('usb', { usbAction: event.action });
        }),
      );
      cleanups.push(
        await adapter.onBatteryChanged((event) => {
          automationService.checkNativeTriggers('bateria', { batteryPercent: event.percent });
        }),
      );

      // Regista as pastas que as automações de ficheiros pedem para observar.
      // A deduplicação é do lado Rust (FileWatchers) — chamar watch_folder
      // para a mesma pasta duas vezes não cria duas threads.
      for (const automation of automationService.list) {
        if (automation.trigger.kind === 'ficheiros' && automation.isEnabled) {
          await adapter.watchFolder(automation.trigger.folderPath);
        }
      }
    })();

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [isDesktop]);

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
      const weather = useWeatherStore.getState().snapshot;

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
        // `themeName` cai no identificador só para temas personalizados, que
        // não têm entrada em `THEMES` — o mesmo limite que a voz já tinha.
        theme: themeName(useThemeStore.getState().theme),
      };
    });
  }, []);

  /**
   * Bloqueio por inatividade (Parte 14).
   *
   * Fecha o que estiver aberto antes de voltar ao login: deixar as janelas de
   * pé por trás do ecrã de bloqueio dava a ver o conteúdo a quem passasse.
   */
  useIdleLock({
    timeoutMinutes: idleLockMinutes,
    isActive: isDesktop,
    onLock: () => {
      useNotificationStore.getState().setPanelOpen(false);
      setPaletteOpen(false);
      logout();
      logService.audit('Bloquear a sessão por inatividade', 'executado');
      notificationService.info(
        'Sessão bloqueada',
        `Sem atividade durante ${idleLockMinutes} minutos.`,
      );
    },
  });

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    // A pesquisa por voz vale para uma abertura só.
    setPaletteQuery('');
  }, []);

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true }, openPalette, isDesktop);

  // Atalhos registados por plugins — ouvidos com um keydown cru em vez de
  // useKeyboardShortcut porque a lista pode mudar enquanto o componente está
  // montado, e hooks não se podem chamar em ciclo.
  useEffect(() => {
    if (!isDesktop) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      // Não dispara dentro de inputs, textareas ou contenteditable.
      const tag = (event.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement).isContentEditable) return;

      const shortcuts = getPluginShortcuts();
      for (const s of shortcuts) {
        if (event.key.toLowerCase() !== s.key.toLowerCase()) continue;
        if (s.ctrlOrMeta !== (event.ctrlKey || event.metaKey)) continue;
        if (s.shift !== event.shiftKey) continue;
        if (s.alt !== event.altKey) continue;

        event.preventDefault();
        pushToPlugin(s.pluginId, { type: 'core.shortcut.triggered', id: s.id });
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop]);

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

        // Fala frase a frase à medida que o texto chega, em vez de esperar
        // pelo fim do streaming inteiro (item 16, reportado ao vivo).
        limparFilaDeFala();
        const geracao = ++askGeracaoRef.current;
        let buffer = '';
        void aiService
          .send(text, (chunk) => {
            if (geracao !== askGeracaoRef.current) return;
            buffer += chunk;
            const { sentences, remainder } = extractSentences(buffer, false);
            buffer = remainder;
            for (const sentence of sentences) speakQueued(sentence);
          })
          .then(() => {
            if (geracao !== askGeracaoRef.current) return;
            if (buffer.trim().length > 0) speakQueued(buffer);
          });
      },
    });
  }, [isDesktop, launch, openPalette, restartBootSequence, setTheme, speakQueued, limparFilaDeFala]);


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

  /**
   * Ferramentas do assistente (Parte 7.2 §Agentes).
   *
   * Mesma injeção da paleta, das automações e da voz. É aqui que o modelo
   * ganha alcance sobre o sistema — e o alcance é exatamente este, nem mais
   * nem menos: o que estiver escrito abaixo.
   */
  useEffect(() => {
    if (!isDesktop) return;

    return setToolExecutor({
      openWindow: (app) => launch(app as AppId),
      closeWindow: (app) => {
        const store = useWindowStore.getState();
        const target = store.windows.find((window) => window.appId === app);
        if (target) store.close(target.id);
        void store.persistLayout();
      },
      closeAllWindows: () => {
        const store = useWindowStore.getState();
        for (const window of [...store.windows]) store.close(window.id);
        void store.persistLayout();
      },
      setTheme: (theme) => setTheme(theme as ThemeId),
      setWallpaper: (wallpaper) => {
        useAppearanceStore.getState().set('wallpaper', wallpaper as WallpaperKind);
        void useAppearanceStore.getState().persist();
      },
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
      goToDesktop: (desktop) => goToDesktop(desktop as DesktopId),
      applyLayout: (name) => {
        // O modelo diz o nome; aqui procura-se o identificador. Pedir-lhe um
        // identificador seria pedir-lhe para adivinhar.
        const layout = useWorkspaceStore
          .getState()
          .layouts.find(
            (entry) =>
              entry.id === name || entry.name.toLowerCase() === name.toLowerCase().trim(),
          );

        return layout ? applyLayout(layout.id) : false;
      },
      saveLayout: (name) => useWorkspaceStore.getState().saveLayout(name),
      createTask: (title, priority, dueAt) => {
        useTaskStore.getState().add(title, priority as TaskPriority, dueAt);
        void useTaskStore.getState().persist();
      },
      completeTask: (title) => {
        const store = useTaskStore.getState();
        const needle = title.toLowerCase().trim();
        const target = store.tasks.find(
          (task) => !task.isDone && task.title.toLowerCase().includes(needle),
        );

        if (!target) return false;

        store.toggle(target.id);
        void store.persist();
        return true;
      },
      clearDoneTasks: () => {
        const store = useTaskStore.getState();
        const count = store.tasks.filter((task) => task.isDone).length;
        store.clearDone();
        void store.persist();
        return count;
      },
      notify: (title, description) =>
        notificationService.info(title, description, { category: 'assistente' }),
      search: (query) => {
        setPaletteQuery(query);
        openPalette();
      },
      searchFiles: (query) =>
        searchFileTree(seedFiles(), query, normalizeSearch).map((result) => ({
          name: result.entry.name,
          pathNames: result.pathNames,
        })),
      openFileLocation: (query) => {
        const [first] = searchFileTree(seedFiles(), query, normalizeSearch);
        if (!first) return false;

        usePendingFileNavigationStore.getState().set(first.path);
        launch('files');
        return true;
      },
      searchNotes: async (query) => {
        await obsidianService.refreshNotes();
        return obsidianService.searchByTitle(query).map((note) => ({
          title: note.title,
          path: note.path,
        }));
      },
      readNote: (query) => obsidianService.readByTitle(query),
      writeNote: (title, content) => obsidianService.write(title, content),
      searchWeb: (query) => webSearchService.search(query),
      openWebPage: (url) => openWebPage(url),
      music: (action) => {
        if (action === 'proxima') void musicService.next();
        else if (action === 'anterior') void musicService.previous();
        else void musicService.togglePlay();
      },
      speak,
      setAutomationEnabled: (name, enabled) => {
        const target = automationService.list.find(
          (entry) => entry.name.toLowerCase() === name.toLowerCase().trim(),
        );
        if (!target) return false;

        automationService.setEnabled(target.id, enabled);
        return true;
      },
      runAutomation: (name) => {
        const target = automationService.list.find(
          (entry) => entry.name.toLowerCase() === name.toLowerCase().trim(),
        );
        if (!target) return false;

        automationService.run(target.id, true);
        return true;
      },
      clearConversations: () => useAssistantStore.getState().reset(),
      forgetMemory: () => memoryService.clear(),
      resetWidgets: () => {
        useWidgetStore.getState().reset();
        void useWidgetStore.getState().persist();
      },
    });
  }, [applyLayout, goToDesktop, isDesktop, launch, openPalette, setTheme, speak]);


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
      goToDesktop,
      applyLayout: (layoutId) => {
        const layout = useWorkspaceStore.getState().getLayout(layoutId);
        if (!applyLayout(layoutId) || !layout) return;

        notificationService.success('Layout aplicado', `${layout.name} está agora no ecrã.`);
      },
    }),
    [applyLayout, goToDesktop, launch, restartBootSequence, setTheme, toggleListening],
  );

  return (
    <>
      <ColourFilters />
      <Wallpaper />
      <CustomCursor />

      {phase === 'booting' && <BootSequence onComplete={completeBoot} />}
      {phase === 'login' && <LoginScreen onAuthenticated={handleAuthenticate} />}

      <AppShell
        isActive={isDesktop}
        onLaunchApp={launch}
        onOpenPalette={openPalette}
        onToggleMicrophone={toggleListening}
        isConversationMode={isConversationMode}
        onToggleConversationMode={toggleConversationMode}
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

      <VoiceCorrection />

      <ToastViewport />
      <NotificationPanel />

      {avatarFlight && (
        <FlyingAvatar
          fromRect={avatarFlight.fromRect}
          targetCenterX={avatarFlight.targetCenterX}
          targetCenterY={avatarFlight.targetCenterY}
          onDone={() => setAvatarFlight(null)}
        />
      )}
    </>
  );
}

/**
 * Avatar que "viaja" do ecrã de login até ao header (Parte 5 §Transição).
 *
 * Renderiza uma cópia do avatar com `position: fixed` na posição de destino
 * (canto superior direito), mas começa deslocada e ampliada até à posição de
 * origem (centro do cartão de login). A transição corre só por
 * `transform`/`opacity` — nunca `top`/`left`.
 */
function FlyingAvatar({
  fromRect,
  targetCenterX,
  targetCenterY,
  onDone,
}: {
  readonly fromRect: DOMRect;
  readonly targetCenterX: number;
  readonly targetCenterY: number;
  readonly onDone: () => void;
}): React.JSX.Element {
  const [phase, setPhase] = useState<'start' | 'fly' | 'done'>('start');
  const doneRef = useRef(false);

  const TARGET_SIZE = 38;
  const fromScale = fromRect.width / TARGET_SIZE;
  const fromCenterX = fromRect.left + fromRect.width / 2;
  const fromCenterY = fromRect.top + fromRect.height / 2;

  useEffect(() => {
    // Um frame depois de montado: aplicar a posição final, que dispara a
    // transição CSS. Sem isto, o browser funde o estado inicial com o novo
    // e a animação nunca se vê.
    const frame = requestAnimationFrame(() => setPhase('fly'));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleTransitionEnd = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('done');
    setTimeout(onDone, 300);
  };

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      className="pointer-events-none"
      style={{
        position: 'fixed',
        zIndex: 9999,
        left: `${targetCenterX - TARGET_SIZE / 2}px`,
        top: `${targetCenterY - TARGET_SIZE / 2}px`,
        width: `${TARGET_SIZE}px`,
        height: `${TARGET_SIZE}px`,
        borderRadius: '50%',
        background: 'linear-gradient(to bottom right, #1d2f42, #0a141d)',
        border: '1px solid rgb(0 207 255 / 0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12.5px',
        fontWeight: 600,
        color: 'var(--accent)',
        transform:
          phase === 'start'
            ? `translate(${fromCenterX - targetCenterX}px, ${fromCenterY - targetCenterY}px) scale(${fromScale})`
            : 'translate(0, 0) scale(1)',
        transition: phase === 'fly' ? 'transform 600ms ease-out, opacity 300ms ease-out' : 'none',
        opacity: phase === 'done' ? 0 : 1,
      }}
    >
      AQ
    </div>
  );
}
