import { lazy } from 'react';
import {
  Bot,
  Calendar,
  FolderOpen,
  Gauge,
  Globe,
  LayoutGrid,
  ListTodo,
  Mail,
  Music,
  Palette,
  Puzzle,
  ShieldCheck,
  SquareTerminal,
  Terminal,
  Zap,
} from 'lucide-react';

import type { AppDefinition, AppId } from '@/types/app';

/**
 * Registo das janelas.
 *
 * É a única lista que o Dock, a Command Palette e o WindowManager consultam.
 * Adicionar uma janela é criar o componente e acrescentar aqui uma entrada —
 * nenhum dos três precisa de saber que a nova janela existe.
 *
 * Os componentes são `lazy`: nenhuma janela pesa no arranque da aplicação.
 */

/** Marcador para as janelas que a Fase 1 ainda não implementa. */
const NotImplemented = lazy(() => import('./not-implemented/NotImplemented'));

export const APP_REGISTRY: Readonly<Record<AppId, AppDefinition>> = {
  assistant: {
    id: 'assistant',
    title: 'Assistente JARVIS',
    icon: Bot,
    // Larga o suficiente para a conversa e o histórico caberem lado a lado.
    defaultSize: { width: 760, height: 520 },
    component: lazy(() => import('./assistant/AssistantWindow')),
    implemented: true,
  },
  calendar: {
    id: 'calendar',
    title: 'Calendário',
    icon: Calendar,
    defaultSize: { width: 420, height: 380 },
    component: lazy(() => import('./calendar/CalendarWindow')),
    implemented: true,
  },
  system: {
    id: 'system',
    title: 'Monitor de recursos',
    icon: Gauge,
    defaultSize: { width: 460, height: 420 },
    component: lazy(() => import('./resource-monitor/ResourceMonitorWindow')),
    implemented: true,
  },
  themes: {
    id: 'themes',
    title: 'Personalização',
    icon: Palette,
    defaultSize: { width: 480, height: 380 },
    component: lazy(() => import('./personalization/PersonalizationWindow')),
    implemented: true,
  },
  plugins: {
    id: 'plugins',
    title: 'Plugins',
    icon: Puzzle,
    defaultSize: { width: 520, height: 460 },
    component: lazy(() => import('./plugin-manager/PluginManagerWindow')),
    implemented: true,
  },
  developer: {
    id: 'developer',
    title: 'Centro de programador',
    icon: Terminal,
    defaultSize: { width: 560, height: 480 },
    component: lazy(() => import('./developer-center/DeveloperCenterWindow')),
    implemented: true,
  },
  privacy: {
    id: 'privacy',
    title: 'Privacidade',
    icon: ShieldCheck,
    defaultSize: { width: 520, height: 460 },
    component: lazy(() => import('./privacy/PrivacyWindow')),
    implemented: true,
  },
  files: {
    id: 'files',
    title: 'Arquivos',
    icon: FolderOpen,
    defaultSize: { width: 480, height: 400 },
    component: lazy(() => import('./files/FilesWindow')),
    implemented: true,
  },
  emails: {
    id: 'emails',
    title: 'Emails',
    icon: Mail,
    defaultSize: { width: 500, height: 440 },
    component: lazy(() => import('./emails/EmailsWindow')),
    implemented: true,
  },
  tasks: {
    id: 'tasks',
    title: 'Tarefas',
    icon: ListTodo,
    defaultSize: { width: 460, height: 420 },
    component: lazy(() => import('./tasks/TasksWindow')),
    implemented: true,
  },
  projects: {
    id: 'projects',
    title: 'Projetos',
    icon: LayoutGrid,
    defaultSize: { width: 460, height: 420 },
    component: lazy(() => import('./projects/ProjectsWindow')),
    implemented: true,
  },
  automations: {
    id: 'automations',
    title: 'Automações',
    icon: Zap,
    defaultSize: { width: 500, height: 460 },
    component: lazy(() => import('./automations/AutomationsWindow')),
    implemented: true,
  },
  terminal: {
    id: 'terminal',
    title: 'Terminal',
    icon: SquareTerminal,
    // Mais larga do que a maioria das janelas — um terminal a 460px de
    // largura corta linhas de comando reais a cada instante.
    defaultSize: { width: 640, height: 420 },
    component: lazy(() => import('./terminal/TerminalWindow')),
    implemented: true,
  },

  // ── Fase 2: registadas para o dock e a paleta as mostrarem, sem implementação ──
  music: {
    id: 'music',
    title: 'Música',
    icon: Music,
    defaultSize: { width: 360, height: 240 },
    component: NotImplemented,
    implemented: false,
  },
  browser: {
    id: 'browser',
    title: 'Navegador',
    icon: Globe,
    defaultSize: { width: 480, height: 340 },
    component: NotImplemented,
    implemented: false,
  },
};

export function getAppDefinition(appId: AppId): AppDefinition {
  return APP_REGISTRY[appId];
}

/** Todas as aplicações, para a Command Palette listar. */
export const ALL_APPS: readonly AppDefinition[] = Object.values(APP_REGISTRY);
