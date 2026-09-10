/** Severidade de uma notificação — determina o ícone e a cor do toast. */
export type NotificationKind = 'info' | 'ok' | 'warn' | 'err';

/**
 * Categorias (Parte 6.2 §Sistema de notificações).
 *
 * Servem para agrupar no painel e para filtrar. Uma notificação sem categoria
 * cai em `sistema`, que é o que a maioria é.
 */
export type NotificationCategory =
  | 'sistema'
  | 'assistente'
  | 'email'
  | 'calendario'
  | 'automacao'
  | 'plugins';

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  sistema: 'Sistema',
  assistente: 'Assistente',
  email: 'Email',
  calendario: 'Calendário',
  automacao: 'Automações',
  plugins: 'Plugins',
};

/** Uma ação rápida oferecida dentro da notificação. */
export interface NotificationAction {
  readonly id: string;
  readonly label: string;
  readonly run: () => void;
}

export interface JarvisNotification {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: NotificationKind;
  readonly category: NotificationCategory;
  readonly createdAt: number;
  /** Milissegundos até o toast desaparecer. `null` mantém até ser fechado. */
  readonly durationMs: number | null;
  /** `false` enquanto não for vista no painel. */
  readonly isRead: boolean;
  /** `true` depois de o toast sair — fica só no painel. */
  readonly isDismissed: boolean;
  readonly actions: readonly NotificationAction[];
}

/** O que entra no histórico persistido. As ações não persistem: são funções. */
export interface PersistedNotification {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: NotificationKind;
  readonly category: NotificationCategory;
  readonly createdAt: number;
  readonly isRead: boolean;
}

/** Tempo em ecrã, do protótipo. */
export const DEFAULT_TOAST_DURATION_MS = 6_800;
/** Quantas notificações o histórico guarda. */
export const NOTIFICATION_HISTORY_LIMIT = 100;
