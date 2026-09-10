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
  /** Criar e fechar janelas (12/08/2026). */
  readonly windows: boolean;
  /** Registar comandos na paleta (12/08/2026). */
  readonly commands: boolean;
  /** Subscrever eventos do barramento (12/08/2026). */
  readonly events: boolean;
  /** Guardar preferências com prefixo isolado por plugin (11/08/2026). */
  readonly storage: boolean;
  /** Registar atalhos de teclado (11/08/2026). */
  readonly shortcuts: boolean;
  /** Criar widgets simples (título + texto) — nunca código nem markup (12/08/2026). */
  readonly widgets: boolean;
  /** Adicionar itens ao menu de contexto do ambiente de trabalho (12/08/2026). */
  readonly menus: boolean;
  /** Declarar definições editáveis, guardadas no armazenamento do plugin (12/08/2026). */
  readonly settings: boolean;
  /** Correr em segundo plano a um intervalo — o Core empurra o "tick" (12/08/2026). */
  readonly services: boolean;
  /** Adicionar um painel de texto expansível à sua própria entrada (12/08/2026). */
  readonly panels: boolean;
  /** Mandar o assistente falar — `core.voice.speak` (15/08/2026). */
  readonly voice: boolean;
  /** Ler a memória que o assistente guardou sobre a pessoa — `core.memory.read` (15/08/2026). */
  readonly memory: boolean;
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

/**
 * Um pacote de plugin para instalação a partir de ficheiro local.
 *
 * É um ficheiro JSON com extensão `.jarvis-plugin`. Contém o manifesto
 * assinado (manifesto + assinatura + chave pública do signatário), mais o
 * código JavaScript que corre dentro da sandbox.
 *
 * A assinatura cobre o `manifest` **e** o `code` — o código entra pelo hash
 * SHA-256 dos seus bytes UTF-8 (não por uma serialização JSON), por isso não
 * há o problema de `JSON.stringify` escapar caracteres de forma diferente
 * entre engines. Trocar o código por outro JavaScript qualquer invalida a
 * assinatura, exatamente como trocar o manifesto. Ver `src/plugins/signature.ts`.
 */
export interface PluginPackage {
  readonly manifest: PluginManifest;
  /** Assinatura Ed25519 (64 bytes raw) codificada em base64. */
  readonly signature: string;
  /** Chave pública do signatário (32 bytes raw) codificada em base64. */
  readonly signerPublicKey: string;
  /** Nome legível do signatário — para a interface, não para verificação. */
  readonly signerName?: string;
  /** Código JavaScript que corre dentro do iframe sandboxed. */
  readonly code: string;
}
