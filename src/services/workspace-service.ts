import { getAppDefinition } from '@/apps/registry';
import { clampPlacement } from '@/components/widgets/grid';
import type { ThemeId } from '@/design-system/tokens';
import { soundService } from '@/services/sound-service';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { ALL_WIDGETS } from '@/widgets/registry';
import type { AppId } from '@/types/app';
import { ambienceOf, type Ambience, type Appearance } from '@/types/appearance';
import type { WindowInstance, WindowRect } from '@/types/window';
import type { WidgetId, WidgetInstance, WidgetPlacement } from '@/types/widget';
import type { WorkspaceScope, WorkspaceSnapshot } from '@/types/workspace';

/**
 * Capturar e repor um espaço de trabalho (Partes 6.2 e 15).
 *
 * Vive à parte das stores de propósito. O `use-window-store` e o
 * `use-widget-store` são as duas peças mais bem testadas do projeto, e a
 * maneira de lhes acrescentar desktops sem arriscar uma regressão é **não lhes
 * tocar**: este serviço lê o que elas já expõem e escreve pelas ações que elas
 * já têm.
 *
 * As funções recebem as stores por parâmetro (`WorkspaceStores`) em vez de as
 * importarem — isto permite testar `captureWorkspace` e `applyWorkspace` sem
 * montar o sistema de stores real. O helper `getWorkspaceStores()` devolve a
 * forma que as stores reais têm, para os callers que as conhecem.
 */

/** A forma mínima das stores que o serviço precisa. */
export interface WorkspaceStores {
  readonly theme: { readonly theme: ThemeId; setTheme(t: ThemeId): void };
  readonly appearance: {
    readonly appearance: Appearance;
    applyAmbience(a: Ambience): void;
    persist(): Promise<void>;
  };
  readonly windows: {
    readonly windows: readonly WindowInstance[];
    open(appId: AppId, title: string, rect: WindowRect): string;
    close(id: string): void;
    toggleMaximize(id: string, maximizedRect: WindowRect): void;
  };
  readonly widgets: {
    readonly widgets: readonly WidgetInstance[];
    replaceWidgets(ws: readonly { readonly id: WidgetId; readonly placement: WidgetPlacement; readonly isVisible: boolean }[]): void;
  };
  readonly plugins: {
    readonly installed: Record<string, { readonly id: string; readonly isEnabled: boolean }>;
    setEnabled(id: string, enabled: boolean): void;
    persist(): Promise<void>;
  };
}

/** As stores reais, no formato que o serviço espera. */
export function getWorkspaceStores(): WorkspaceStores {
  return {
    theme: {
      get theme() { return useThemeStore.getState().theme; },
      setTheme: (t) => useThemeStore.getState().setTheme(t),
    },
    appearance: {
      get appearance() { return useAppearanceStore.getState().appearance; },
      applyAmbience: (a) => useAppearanceStore.getState().applyAmbience(a),
      persist: () => useAppearanceStore.getState().persist(),
    },
    windows: {
      get windows() { return useWindowStore.getState().windows; },
      open: (appId, title, rect) => useWindowStore.getState().open(appId, title, rect),
      close: (id) => useWindowStore.getState().close(id),
      toggleMaximize: (id, maximizedRect) => useWindowStore.getState().toggleMaximize(id, maximizedRect),
    },
    widgets: {
      get widgets() { return useWidgetStore.getState().widgets; },
      replaceWidgets: (ws) => useWidgetStore.setState({ widgets: ws }),
    },
    plugins: {
      get installed() { return usePluginStore.getState().installed; },
      setEnabled: (id, enabled) => usePluginStore.getState().setEnabled(id, enabled),
      persist: () => usePluginStore.getState().persist(),
    },
  };
}

/** Onde uma janela reaparece quando a geometria guardada não serve. */
export interface ViewportInsets {
  readonly width: number;
  readonly height: number;
}

export function captureWorkspace(stores: WorkspaceStores): WorkspaceSnapshot {
  const windows = stores.windows.windows;
  const widgets = stores.widgets.widgets;

  return {
    windows: windows.map((window) => ({
      appId: window.appId,
      // A geometria restaurada, não a maximizada — é a mesma razão do
      // `persistLayout`: reabrir com o tamanho de outro ecrã dá uma janela
      // fora do sítio.
      rect: window.restoreRect ?? window.rect,
      isMaximized: window.isMaximized,
    })),
    widgets: widgets.map((widget) => ({
      id: widget.id,
      placement: widget.placement,
      isVisible: widget.isVisible,
    })),
    theme: stores.theme.theme,
    ambience: ambienceOf(stores.appearance.appearance),
    sound: soundService.snapshot(),
    // Ordenado por identificador: uma fotografia tirada duas vezes seguidas
    // tem de dar o mesmo ficheiro, e a ordem de inserção de um objeto não é
    // coisa em que se confie para isso.
    plugins: Object.values(stores.plugins.installed)
      .map((plugin) => ({ id: plugin.id, isEnabled: plugin.isEnabled }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * Repõe um espaço de trabalho.
 *
 * `rectFor` decide onde cada janela vai parar: quem chama passa a geometria
 * guardada no desktop, ou uma centrada quando o ecrã é estreito de mais para a
 * respeitar. Sem isto o serviço precisava de saber o que é um telemóvel.
 *
 * `scope` decide até onde vai a reposição. Janelas, widgets, tema e ambiente
 * são o espaço de trabalho e repõem-se sempre; som e plugins são definições, e
 * essas só se repõem quando se aplica um perfil de propósito.
 */
export function applyWorkspace(
  snapshot: WorkspaceSnapshot,
  rectFor: (entry: WorkspaceSnapshot['windows'][number]) => WindowRect,
  stores: WorkspaceStores,
  scope: WorkspaceScope = 'desktop',
  /**
   * Onde maximizar uma janela que estava maximizada, no ecrã de agora. `null`
   * (ou a ausência da função) deixa-a com a geometria restaurada. Quem chama
   * conhece o ecrã, e por isso decide se maximizar faz sentido — no compacto,
   * por exemplo, não.
   */
  maximizeRectFor?: (entry: WorkspaceSnapshot['windows'][number]) => WindowRect | null,
): void {
  const windowStore = stores.windows;

  // Fechar antes de abrir: sem isto, mudar de desktop deixava as janelas do
  // anterior por cima das novas.
  for (const window of windowStore.windows) windowStore.close(window.id);

  for (const entry of snapshot.windows) {
    const definition = getAppDefinition(entry.appId);
    const id = windowStore.open(entry.appId, definition.title, rectFor(entry));

    // `captureWorkspace` guarda o `isMaximized` à parte da geometria (que é a
    // restaurada, não a maximizada) exatamente para uma janela maximizada
    // voltar maximizada no ecrã atual. Sem isto, o flag ficava gravado e nunca
    // era lido de volta: a janela reabria sempre com o tamanho normal.
    if (entry.isMaximized) {
      const maximized = maximizeRectFor?.(entry);
      if (maximized) windowStore.toggleMaximize(id, maximized);
    }
  }

  // Um widget guardado que já não exista no registo é descartado, como na
  // hidratação — acontece ao remover um widget entre versões.
  const known = new Set(ALL_WIDGETS.map((definition) => definition.id));
  stores.widgets.replaceWidgets(
    snapshot.widgets
      .filter((entry) => known.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        placement: clampPlacement(entry.placement),
        isVisible: entry.isVisible,
      })),
  );

  stores.theme.setTheme(snapshot.theme);
  stores.appearance.applyAmbience(snapshot.ambience);
  void stores.appearance.persist();

  if (scope !== 'perfil') return;

  if (snapshot.sound) {
    soundService.applySnapshot(snapshot.sound);
    void soundService.persist();
  }

  if (snapshot.plugins.length > 0) {
    const plugins = stores.plugins;
    // `setEnabled` ignora identificadores que não conhece, e é o que se quer:
    // um plugin removido da loja entre versões não pode partir a reposição.
    for (const entry of snapshot.plugins) plugins.setEnabled(entry.id, entry.isEnabled);
    void plugins.persist();
  }
}
