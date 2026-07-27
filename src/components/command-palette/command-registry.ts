import { LayoutGrid, Mic, Palette, RotateCcw, type LucideIcon } from 'lucide-react';

import { ALL_APPS } from '@/apps/registry';
import { THEMES } from '@/design-system/tokens';
import { ALL_WIDGETS } from '@/widgets/registry';
import type { AppId } from '@/types/app';
import type { ThemeId } from '@/design-system/tokens';
import type { WidgetId } from '@/types/widget';

/** Grupos pela ordem em que aparecem na paleta. */
export type CommandGroup = 'Aplicações' | 'Widgets' | 'Sistema' | 'Temas';

export interface Command {
  readonly id: string;
  readonly group: CommandGroup;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Texto à direita — diz o que o comando faz. */
  readonly hint: string;
  readonly run: (actions: CommandActions) => void;
}

/**
 * O que a paleta pode fazer.
 *
 * Passado de fora em vez de importado: sem isto, a paleta acabaria a conhecer o
 * WindowManager, o serviço de voz e a sessão, e a testá-la exigiria montar tudo.
 */
export interface CommandActions {
  readonly launchApp: (appId: AppId) => void;
  readonly setTheme: (theme: ThemeId) => void;
  readonly toggleMicrophone: () => void;
  readonly restartBootSequence: () => void;
  readonly toggleWidget: (widgetId: WidgetId) => void;
  readonly resetWidgets: () => void;
}

/**
 * Constrói a lista de comandos.
 *
 * As aplicações e os temas são derivados dos respetivos registos: acrescentar
 * uma janela ou um tema fá-los aparecer aqui sem editar este ficheiro.
 */
export function buildCommands(): readonly Command[] {
  const appCommands: Command[] = ALL_APPS.map((app) => ({
    id: `app:${app.id}`,
    group: app.id === 'system' || app.id === 'themes' ? 'Sistema' : 'Aplicações',
    label: `Abrir ${app.title}`,
    icon: app.icon,
    hint: app.implemented ? 'Janela' : 'Fase 2',
    run: (actions) => actions.launchApp(app.id),
  }));

  const themeCommands: Command[] = THEMES.map((theme) => ({
    id: `theme:${theme.id}`,
    group: 'Temas',
    label: `Tema ${theme.name}`,
    icon: Palette,
    hint: 'Aplicar',
    run: (actions) => actions.setTheme(theme.id),
  }));

  // Derivados do registo de widgets, tal como as aplicações e os temas.
  const widgetCommands: Command[] = ALL_WIDGETS.map((widget) => ({
    id: `widget:${widget.id}`,
    group: 'Widgets',
    label: `Mostrar ou esconder ${widget.name}`,
    icon: widget.icon,
    hint: 'Widget',
    run: (actions) => actions.toggleWidget(widget.id),
  }));

  const systemCommands: Command[] = [
    {
      id: 'system:reset-widgets',
      group: 'Sistema',
      label: 'Repor o arranjo dos widgets',
      icon: LayoutGrid,
      hint: 'Widgets',
      run: (actions) => actions.resetWidgets(),
    },
    {
      id: 'system:microphone',
      group: 'Sistema',
      label: 'Ativar microfone',
      icon: Mic,
      hint: 'Voz',
      run: (actions) => actions.toggleMicrophone(),
    },
    {
      id: 'system:restart-boot',
      group: 'Sistema',
      label: 'Reiniciar sequência de arranque',
      icon: RotateCcw,
      hint: 'Recarrega',
      run: (actions) => actions.restartBootSequence(),
    },
  ];

  // Ordenados por grupo, para os cabeçalhos não se repetirem na lista.
  const order: readonly CommandGroup[] = ['Aplicações', 'Widgets', 'Sistema', 'Temas'];
  return [...appCommands, ...widgetCommands, ...systemCommands, ...themeCommands].sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
  );
}

/**
 * Filtra por texto.
 *
 * Compara sem acentos, para "personalizacao" encontrar "Personalização" —
 * escrever acentos numa pesquisa rápida é atrito desnecessário.
 */
export function filterCommands(commands: readonly Command[], query: string): readonly Command[] {
  const normalized = normalize(query);
  if (normalized.length === 0) return commands;

  return commands.filter((command) =>
    normalize(`${command.label} ${command.group}`).includes(normalized),
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
