/**
 * Fase 2 — Sistema de plugins.
 *
 * Só a interface. Sem implementação, de propósito: o âmbito da Fase 1 pára
 * aqui, mas o contrato fica escrito para o WindowManager e o registo de
 * aplicações não terem de mudar quando os plugins chegarem.
 */

import type { AppDefinition } from '@/types/app';

export type PluginId = string;

/** O que um plugin pode fazer. Concedido no momento da instalação. */
export interface PluginPermissions {
  readonly filesystem: boolean;
  readonly network: boolean;
  readonly systemMetrics: boolean;
  readonly notifications: boolean;
  readonly shell: boolean;
}

export interface PluginManifest {
  readonly id: PluginId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly permissions: PluginPermissions;
  /** Plataformas onde o plugin funciona. */
  readonly platforms: readonly ('desktop' | 'android')[];
}

/**
 * Um plugin instalado.
 *
 * As janelas que contribui entram no registo de aplicações — daí reutilizar
 * `AppDefinition` em vez de inventar um tipo paralelo.
 */
export interface Plugin {
  readonly manifest: PluginManifest;
  readonly windows: readonly AppDefinition[];
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
}

export interface PluginManager {
  list(): readonly Plugin[];
  install(source: string): Promise<Plugin>;
  uninstall(id: PluginId): Promise<void>;
  enable(id: PluginId): Promise<void>;
  disable(id: PluginId): Promise<void>;
}
