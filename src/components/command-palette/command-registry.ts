import { Mic, Palette, RotateCcw, type LucideIcon } from 'lucide-react';

import { ALL_APPS } from '@/apps/registry';
import { THEMES } from '@/design-system/tokens';
import type { AppId } from '@/types/app';
import type { ThemeId } from '@/design-system/tokens';

/** Grupos pela ordem em que aparecem na paleta. */
export type CommandGroup = 'Aplicações' | 'Sistema' | 'Temas';

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

  const systemCommands: Command[] = [
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
  const order: readonly CommandGroup[] = ['Aplicações', 'Sistema', 'Temas'];
  return [...appCommands, ...systemCommands, ...themeCommands].sort(
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
