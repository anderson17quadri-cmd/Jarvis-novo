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
 * Manifesto assinado pelo autor.
 *
 * A assinatura cobre a representação canónica do `manifest` (chaves ordenadas,
 * sem espaços). `signerPublicKey` é a chave pública Ed25519 em base64 (32 bytes
 * raw). `signature` são os 64 bytes da assinatura Ed25519, também em base64.
 *
 * Ver `src/plugins/signature.ts` para gerar, assinar e verificar.
 */
export interface SignedManifest {
  readonly manifest: PluginManifest;
  /** Assinatura Ed25519 (64 bytes raw) codificada em base64. */
  readonly signature: string;
  /** Chave pública do signatário (32 bytes raw) codificada em base64. */
  readonly signerPublicKey: string;
  /** Nome legível do signatário — para a interface, não para verificação. */
  readonly signerName?: string;
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
 * A assinatura cobre só o `manifest` — o `code` não faz parte da assinatura
 * porque não é serializado na forma canónica (pode conter caracteres que o
 * `JSON.stringify` escape de forma diferente entre engines). Para plugins
 * externos, a assinatura do manifesto é o suficiente para provar a
 * identidade do autor; o código corre num iframe restrito e não pode fazer
 * nada além do que o manifesto declara nas permissões.
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
