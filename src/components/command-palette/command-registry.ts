import {
  Bell,
  LayoutGrid,
  Mail,
  Mic,
  Newspaper,
  Palette,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

import { ALL_APPS } from '@/apps/registry';
import { THEMES } from '@/design-system/tokens';
import { ALL_WIDGETS } from '@/widgets/registry';
import { normalizeSearch as normalize } from '@/utils/text';
import type { AppId } from '@/types/app';
import type { ThemeId } from '@/design-system/tokens';
import type { WidgetId } from '@/types/widget';
import type { MailMessage } from '@/types/mail';
import type { NewsArticle } from '@/types/news';
import type { JarvisNotification } from '@/types/notification';

/**
 * Grupos, pela ordem em que aparecem.
 *
 * Os resultados de conteúdo (Emails, Notícias, Notificações) vêm primeiro:
 * quem escreve um nome está à procura de uma coisa, não de um comando.
 */
export type CommandGroup =
  | 'Emails'
  | 'Notícias'
  | 'Notificações'
  | 'Aplicações'
  | 'Widgets'
  | 'Sistema'
  | 'Temas';

const GROUP_ORDER: readonly CommandGroup[] = [
  'Emails',
  'Notícias',
  'Notificações',
  'Aplicações',
  'Widgets',
  'Sistema',
  'Temas',
];

export interface Command {
  readonly id: string;
  readonly group: CommandGroup;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Texto à direita — diz o que o comando faz. */
  readonly hint: string;
  /** Termos extra que também encontram este comando. */
  readonly keywords?: string;
  readonly run: (actions: CommandActions) => void;
}

/**
 * O que a paleta pode fazer.
 *
 * Passado de fora em vez de importado: sem isto, a paleta acabaria a conhecer o
 * WindowManager, o serviço de voz e a sessão, e testá-la exigiria montar tudo.
 */
export interface CommandActions {
  readonly launchApp: (appId: AppId) => void;
  readonly setTheme: (theme: ThemeId) => void;
  readonly toggleMicrophone: () => void;
  readonly restartBootSequence: () => void;
  readonly toggleWidget: (widgetId: WidgetId) => void;
  readonly resetWidgets: () => void;
  readonly openNotifications: () => void;
  readonly openExternal: (url: string) => void;
  readonly markMailRead: (messageId: string) => void;
}

/** Conteúdo pesquisável, injetado por quem monta a paleta. */
export interface SearchableContent {
  readonly mail: readonly MailMessage[];
  readonly news: readonly NewsArticle[];
  readonly notifications: readonly JarvisNotification[];
}

const EMPTY_CONTENT: SearchableContent = { mail: [], news: [], notifications: [] };

/** Janelas que são configuração do próprio sistema, não aplicações do dia a dia. */
const SYSTEM_APPS: ReadonlySet<AppId> = new Set<AppId>(['system', 'themes', 'plugins']);

/**
 * Constrói a lista de comandos.
 *
 * Aplicações, widgets e temas são derivados dos respetivos registos:
 * acrescentar um deles fá-lo aparecer aqui sem editar este ficheiro. O
 * conteúdo vem de fora, porque muda a cada sondagem.
 */
export function buildCommands(content: SearchableContent = EMPTY_CONTENT): readonly Command[] {
  const appCommands: Command[] = ALL_APPS.map((app) => ({
    id: `app:${app.id}`,
    group: SYSTEM_APPS.has(app.id) ? 'Sistema' : 'Aplicações',
    label: `Abrir ${app.title}`,
    icon: app.icon,
    hint: app.implemented ? 'Janela' : 'Fase 2',
    run: (actions) => actions.launchApp(app.id),
  }));

  const widgetCommands: Command[] = ALL_WIDGETS.map((widget) => ({
    id: `widget:${widget.id}`,
    group: 'Widgets',
    label: `Mostrar ou esconder ${widget.name}`,
    icon: widget.icon,
    hint: 'Widget',
    keywords: widget.description,
    run: (actions) => actions.toggleWidget(widget.id),
  }));

  const themeCommands: Command[] = THEMES.map((theme) => ({
    id: `theme:${theme.id}`,
    group: 'Temas',
    label: `Tema ${theme.name}`,
    icon: Palette,
    hint: 'Aplicar',
    run: (actions) => actions.setTheme(theme.id),
  }));

  // ── Conteúdo ────────────────────────────────────────────────────────────
  const mailCommands: Command[] = content.mail.map((message) => ({
    id: `mail:${message.id}`,
    group: 'Emails',
    label: message.subject,
    icon: Mail,
    hint: message.from,
    keywords: `${message.from} ${message.preview}`,
    run: (actions) => {
      actions.markMailRead(message.id);
      actions.launchApp('emails');
    },
  }));

  const newsCommands: Command[] = content.news.map((article) => ({
    id: `news:${article.id}`,
    group: 'Notícias',
    label: article.title,
    icon: Newspaper,
    hint: article.source,
    keywords: `${article.summary} ${article.category}`,
    run: (actions) => actions.openExternal(article.url),
  }));

  const notificationCommands: Command[] = content.notifications.map((notification) => ({
    id: `notif:${notification.id}`,
    group: 'Notificações',
    label: notification.title,
    icon: Bell,
    hint: 'Abrir painel',
    keywords: notification.description,
    run: (actions) => actions.openNotifications(),
  }));

  const systemCommands: Command[] = [
    {
      id: 'system:notifications',
      group: 'Sistema',
      label: 'Abrir painel de notificações',
      icon: Bell,
      hint: 'Painel',
      run: (actions) => actions.openNotifications(),
    },
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
  return [
    ...mailCommands,
    ...newsCommands,
    ...notificationCommands,
    ...appCommands,
    ...widgetCommands,
    ...systemCommands,
    ...themeCommands,
  ].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}

/** Grupos de conteúdo: só aparecem quando há pesquisa. */
const CONTENT_GROUPS: ReadonlySet<CommandGroup> = new Set(['Emails', 'Notícias', 'Notificações']);

/**
 * Filtra por texto.
 *
 * Sem pesquisa, esconde o conteúdo — abrir a paleta e ver cinquenta emails
 * antes dos comandos seria inútil. Com pesquisa, procura em tudo.
 *
 * Compara sem acentos, para "personalizacao" encontrar "Personalização".
 */
export function filterCommands(
  commands: readonly Command[],
  query: string,
): readonly Command[] {
  const normalized = normalize(query);

  if (normalized.length === 0) {
    return commands.filter((command) => !CONTENT_GROUPS.has(command.group));
  }

  return commands.filter((command) =>
    normalize(`${command.label} ${command.group} ${command.keywords ?? ''}`).includes(normalized),
  );
}
