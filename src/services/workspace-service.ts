import { getAppDefinition } from '@/apps/registry';
import { clampPlacement } from '@/components/widgets/grid';
import { soundService } from '@/services/sound-service';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWindowStore } from '@/stores/use-window-store';
import { ALL_WIDGETS } from '@/widgets/registry';
import { ambienceOf } from '@/types/appearance';
import type { WindowRect } from '@/types/window';
import type { WorkspaceScope, WorkspaceSnapshot } from '@/types/workspace';

/**
 * Capturar e repor um espaço de trabalho (Partes 6.2 e 15).
 *
 * Vive à parte das stores de propósito. O `use-window-store` e o
 * `use-widget-store` são as duas peças mais bem testadas do projeto, e a
 * maneira de lhes acrescentar desktops sem arriscar uma regressão é **não lhes
 * tocar**: este serviço lê o que elas já expõem e escreve pelas ações que elas
 * já têm.
 */

/** Onde uma janela reaparece quando a geometria guardada não serve. */
export interface ViewportInsets {
  readonly width: number;
  readonly height: number;
}

export function captureWorkspace(): WorkspaceSnapshot {
  const windows = useWindowStore.getState().windows;
  const widgets = useWidgetStore.getState().widgets;

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
    theme: useThemeStore.getState().theme,
    ambience: ambienceOf(useAppearanceStore.getState().appearance),
    sound: soundService.snapshot(),
    // Ordenado por identificador: uma fotografia tirada duas vezes seguidas
    // tem de dar o mesmo ficheiro, e a ordem de inserção de um objeto não é
    // coisa em que se confie para isso.
    plugins: Object.values(usePluginStore.getState().installed)
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
  scope: WorkspaceScope = 'desktop',
): void {
  const windowStore = useWindowStore.getState();

  // Fechar antes de abrir: sem isto, mudar de desktop deixava as janelas do
  // anterior por cima das novas.
  for (const window of windowStore.windows) windowStore.close(window.id);

  for (const entry of snapshot.windows) {
    const definition = getAppDefinition(entry.appId);
    useWindowStore.getState().open(entry.appId, definition.title, rectFor(entry));
  }

  // Um widget guardado que já não exista no registo é descartado, como na
  // hidratação — acontece ao remover um widget entre versões.
  const known = new Set(ALL_WIDGETS.map((definition) => definition.id));
  useWidgetStore.setState({
    widgets: snapshot.widgets
      .filter((entry) => known.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        placement: clampPlacement(entry.placement),
        isVisible: entry.isVisible,
      })),
  });

  useThemeStore.getState().setTheme(snapshot.theme);
  useAppearanceStore.getState().applyAmbience(snapshot.ambience);
  void useAppearanceStore.getState().persist();

  if (scope !== 'perfil') return;

  if (snapshot.sound) {
    soundService.applySnapshot(snapshot.sound);
    void soundService.persist();
  }

  if (snapshot.plugins.length > 0) {
    const plugins = usePluginStore.getState();
    // `setEnabled` ignora identificadores que não conhece, e é o que se quer:
    // um plugin removido da loja entre versões não pode partir a reposição.
    for (const entry of snapshot.plugins) plugins.setEnabled(entry.id, entry.isEnabled);
    void usePluginStore.getState().persist();
  }
}
