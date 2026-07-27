/** Severidade de uma notificação — determina o ícone e a cor do toast. */
export type NotificationKind = 'info' | 'ok' | 'warn' | 'err';

export interface JarvisNotification {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: NotificationKind;
  readonly createdAt: number;
  /** Milissegundos até desaparecer sozinho. `null` mantém até ser fechado. */
  readonly durationMs: number | null;
}

/** Tempo em ecrã, do protótipo. */
export const DEFAULT_TOAST_DURATION_MS = 6_800;
