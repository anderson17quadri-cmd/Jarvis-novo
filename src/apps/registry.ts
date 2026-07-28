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
    defaultSize: { width: 520, height: 440 },
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

  // ── Fase 2: registadas para o dock e a paleta as mostrarem, sem implementação ──
  terminal: {
    id: 'terminal',
    title: 'Terminal',
    icon: Terminal,
    defaultSize: { width: 460, height: 300 },
    component: NotImplemented,
    implemented: false,
  },
  automations: {
    id: 'automations',
    title: 'Automações',
    icon: Zap,
    defaultSize: { width: 440, height: 320 },
    component: NotImplemented,
    implemented: false,
  },
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
