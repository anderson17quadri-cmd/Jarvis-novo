import {
  Activity,
  Bot,
  Calendar,
  ChartNoAxesColumn,
  Cloud,
  Download,
  FolderOpen,
  Gauge,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Mail,
  MessageSquare,
  Monitor,
  Music,
  Palette,
  Puzzle,
  Search,
  Settings,
  StickyNote,
  Terminal,
  User,
  LogOut,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { AppId } from '@/types/app';

/** Ação de um item do rail que não abre uma janela. */
export type RailAction = 'search' | 'logout';

export interface RailItem {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** A janela que abre, se abrir alguma. */
  readonly appId?: AppId;
  /** Ação especial, para os itens que não são janelas. */
  readonly action?: RailAction;
}

/** `null` desenha um separador. Mesma ordem do protótipo. */
export const RAIL_ITEMS: readonly (RailItem | null)[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assistant', label: 'Assistente', icon: Bot, appId: 'assistant' },
  { id: 'search', label: 'Pesquisa', icon: Search, action: 'search' },
  { id: 'files', label: 'Arquivos', icon: FolderOpen, appId: 'files' },
  { id: 'projects', label: 'Projetos', icon: LayoutGrid, appId: 'projects' },
  { id: 'calendar', label: 'Calendário', icon: Calendar, appId: 'calendar' },
  { id: 'tasks', label: 'Tarefas', icon: ListTodo, appId: 'tasks' },
  { id: 'emails', label: 'Emails', icon: Mail, appId: 'emails' },
  { id: 'messages', label: 'Mensagens', icon: MessageSquare },
  { id: 'notes', label: 'Notas', icon: StickyNote },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'automations', label: 'Automações', icon: Zap, appId: 'automations' },
  { id: 'devices', label: 'Dispositivos', icon: Monitor },
  { id: 'analytics', label: 'Analytics', icon: ChartNoAxesColumn, appId: 'system' },
  null,
  { id: 'plugins', label: 'Plugins', icon: Puzzle, appId: 'plugins' },
  { id: 'settings', label: 'Configurações', icon: Settings, appId: 'themes' },
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'logout', label: 'Terminar sessão', icon: LogOut, action: 'logout' },
];

export interface DockItem {
  readonly appId: AppId;
  readonly label: string;
  readonly icon: LucideIcon;
}

export const DOCK_ITEMS: readonly DockItem[] = [
  { appId: 'files', label: 'Explorador', icon: FolderOpen },
  { appId: 'terminal', label: 'Terminal', icon: Terminal },
  { appId: 'assistant', label: 'Assistente', icon: Bot },
  { appId: 'browser', label: 'Navegador', icon: Globe },
  { appId: 'emails', label: 'Email', icon: Mail },
  { appId: 'music', label: 'Música', icon: Music },
  { appId: 'calendar', label: 'Calendário', icon: Calendar },
  { appId: 'projects', label: 'Projetos', icon: LayoutGrid },
  { appId: 'system', label: 'Recursos', icon: Gauge },
  { appId: 'themes', label: 'Personalização', icon: Palette },
  { appId: 'plugins', label: 'Plugins', icon: Puzzle },
];

/** Ícones usados na sequência de arranque. */
export const BOOT_ICONS = { Activity, Cloud } as const;
