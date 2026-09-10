import { getAppDefinition } from '@/apps/registry';
import { THEMES, type ThemeId } from '@/design-system/tokens';
import { SYSTEM_STATES, type SystemStateId } from '@/types/system-state';
import { getWidgetDefinition } from '@/widgets/registry';
import type { AppId } from '@/types/app';
import type { WidgetId } from '@/types/widget';

/**
 * Nomes, não identificadores (Partes 10 e 13).
 *
 * "Abrir emails" e "o tema oled" já escaparam para o ecrã duas vezes neste
 * projeto: nos comandos de voz, e nas automações. As duas frases que se
 * escrevem sobre uma ação — `describeIntent` na voz, `describeAction` nas
 * automações — precisam do mesmo nome, e é por isso que vive aqui e não
 * duplicado nos dois sítios: um só lugar onde a tradução pode divergir do que
 * a interface mostra é um lugar a menos onde isto volta a acontecer.
 */

export function appTitle(appId: AppId): string {
  return getAppDefinition(appId).title;
}

/**
 * O nome de um tema, ou o identificador quando é personalizado.
 *
 * Os temas do utilizador não estão em `THEMES` — vivem noutro store, e ir lá
 * buscá-los daqui punha uma função pura a depender de estado.
 */
export function themeName(theme: ThemeId): string {
  return THEMES.find((entry) => entry.id === theme)?.name ?? theme;
}

export function widgetName(widget: WidgetId): string {
  return getWidgetDefinition(widget).name;
}

export function stateName(state: SystemStateId): string {
  return SYSTEM_STATES[state].name;
}
