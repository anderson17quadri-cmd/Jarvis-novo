import type { AppId } from './app';

export interface WindowRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Bordas onde uma janela encaixa ao ser largada. */
export type SnapEdge = 'left' | 'right' | 'top' | 'none';

export interface WindowInstance {
  readonly id: string;
  readonly appId: AppId;
  readonly title: string;
  readonly rect: WindowRect;
  readonly zIndex: number;
  readonly isMinimized: boolean;
  readonly isMaximized: boolean;
  /** Geometria antes de maximizar, para o restauro devolver o tamanho certo. */
  readonly restoreRect: WindowRect | null;
}

/** O que é guardado entre sessões — só a geometria, não o conteúdo. */
export interface PersistedWindowLayout {
  readonly appId: AppId;
  readonly rect: WindowRect;
  readonly isMaximized: boolean;
}

export const WINDOW_MIN_WIDTH = 280;
export const WINDOW_MIN_HEIGHT = 180;
