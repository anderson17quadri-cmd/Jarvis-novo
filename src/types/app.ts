import type { LucideIcon } from 'lucide-react';
import type { ComponentType, LazyExoticComponent } from 'react';

/** Identificador de uma aplicação. */
export type AppId =
  | 'assistant'
  | 'calendar'
  | 'system'
  | 'themes'
  | 'files'
  | 'terminal'
  | 'emails'
  | 'tasks'
  | 'projects'
  | 'automations'
  | 'music'
  | 'browser'
  | 'plugins'
  | 'developer'
  | 'privacy';

/**
 * Definição de uma janela.
 *
 * Acrescentar uma janela é criar um ficheiro e uma entrada em `apps/registry.ts`.
 * O Dock, a Command Palette e o WindowManager leem daqui — não se tocam uns aos
 * outros nem precisam de saber que a nova janela existe.
 */
export interface AppDefinition {
  readonly id: AppId;
  readonly title: string;
  readonly icon: LucideIcon;
  /** Tamanho inicial no desktop. No compacto a janela ocupa a largura toda. */
  readonly defaultSize: { readonly width: number; readonly height: number };
  readonly minSize?: { readonly width: number; readonly height: number };
  /** Carregado sob demanda: nenhuma janela pesa no arranque. */
  readonly component: LazyExoticComponent<ComponentType>;
  /** `false` para janelas ainda não implementadas — abrem com um aviso. */
  readonly implemented: boolean;
}
