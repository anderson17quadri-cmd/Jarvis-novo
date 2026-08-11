import type { PluginPermissions } from '@/plugins/plugin';

/**
 * Protocolo entre um plugin isolado (dentro do `<iframe sandbox>`) e o Core.
 *
 * Cada capacidade é uma permissão declarada no manifesto (`plugin-catalog.ts`)
 * e um tipo de mensagem próprio — nunca uma chamada direta. O plugin não tem
 * acesso a nada além de `postMessage`; é o Core quem decide, do lado de fora,
 * se o pedido se cumpre.
 */

// ─── Notificações ────────────────────────────────────────────────────────

export interface PluginNotifyRequest {
  readonly type: 'core.notify';
  readonly requestId: string;
  readonly payload: {
    readonly titulo: string;
    readonly corpo: string;
  };
}

// ─── Ficheiros (pasta declarada no manifesto, nunca o disco inteiro) ─────

export interface PluginFsReadRequest {
  readonly type: 'core.fs.read';
  readonly requestId: string;
  readonly payload: {
    /** Caminho relativo à raiz do plugin (ex.: "dados/config.json"). */
    readonly caminho: string;
  };
}

export interface PluginFsWriteRequest {
  readonly type: 'core.fs.write';
  readonly requestId: string;
  readonly payload: {
    readonly caminho: string;
    readonly conteudo: string;
  };
}

export interface PluginFsListRequest {
  readonly type: 'core.fs.list';
  readonly requestId: string;
  readonly payload: {
    /** Caminho relativo — '' para a raiz. */
    readonly caminho: string;
  };
}

// ─── Rede (domínios autorizados no manifesto) ─────────────────────────────

export interface PluginFetchRequest {
  readonly type: 'core.fetch';
  readonly requestId: string;
  readonly payload: {
    readonly url: string;
    readonly metodo?: string;
    readonly cabecalhos?: Record<string, string>;
    readonly corpo?: string;
  };
}

// ─── Automações (disparar as que já existem, nunca criar) ─────────────────

export interface PluginAutomationRunRequest {
  readonly type: 'core.automation.run';
  readonly requestId: string;
  readonly payload: {
    /** Nome exato da automação, tal como aparece na janela de Automações. */
    readonly nome: string;
  };
}

// ─── Janelas (criar, fechar) — plugins.windows (12/08/2026) ────────────

export interface PluginWindowOpenRequest {
  readonly type: 'core.window.open';
  readonly requestId: string;
  readonly payload: {
    /** Identificador da janela (ex.: 'emails', 'tarefas'). */
    readonly app: string;
    /** Título opcional para a janela. */
    readonly titulo?: string;
  };
}

// ─── Comandos (registar na paleta) — plugins.commands (12/08/2026) ──────

export interface PluginCommandRegisterRequest {
  readonly type: 'core.command.register';
  readonly requestId: string;
  readonly payload: {
    readonly id: string;
    readonly nome: string;
    readonly descricao: string;
  };
}

// ─── Eventos (subscrever o barramento) — plugins.events (12/08/2026) ────

export interface PluginEventSubscribeRequest {
  readonly type: 'core.event.subscribe';
  readonly requestId: string;
  readonly payload: {
    /** Nome do evento a subscrever (ex.: 'tarefa:concluida'). */
    readonly evento: string;
  };
}

// ─── União ────────────────────────────────────────────────────────────────

export type PluginToCoreMessage =
  | PluginNotifyRequest
  | PluginFsReadRequest
  | PluginFsWriteRequest
  | PluginFsListRequest
  | PluginFetchRequest
  | PluginAutomationRunRequest
  | PluginWindowOpenRequest
  | PluginCommandRegisterRequest
  | PluginEventSubscribeRequest;

/** A permissão que cada tipo de pedido exige. */
export const PERMISSION_BY_MESSAGE_TYPE: Record<
  PluginToCoreMessage['type'],
  keyof PluginPermissions
> = {
  'core.notify': 'notifications',
  'core.fs.read': 'filesystem',
  'core.fs.write': 'filesystem',
  'core.fs.list': 'filesystem',
  'core.fetch': 'network',
  'core.automation.run': 'notifications',
  'core.window.open': 'windows',
  'core.command.register': 'commands',
  'core.event.subscribe': 'events',
};

// ─── Resposta do Core ─────────────────────────────────────────────────────

export interface CoreAckMessage {
  readonly type: 'core.ack';
  readonly requestId: string;
  readonly ok: boolean;
  readonly reason?: string;
  /** Dados extra — corpo do ficheiro lido, lista de ficheiros, resposta da rede. */
  readonly data?: unknown;
}

// ─── Validação ────────────────────────────────────────────────────────────

const KNOWN_TYPES = new Set<PluginToCoreMessage['type']>([
  'core.notify',
  'core.fs.read',
  'core.fs.write',
  'core.fs.list',
  'core.fetch',
  'core.automation.run',
  'core.window.open',
  'core.command.register',
  'core.event.subscribe',
]);

/** Confirma que uma mensagem recebida por postMessage tem a forma esperada. */
export function isPluginToCoreMessage(data: unknown): data is PluginToCoreMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  if (typeof message.type !== 'string' || !KNOWN_TYPES.has(message.type as PluginToCoreMessage['type'])) {
    return false;
  }
  if (typeof message.requestId !== 'string') return false;
  if (typeof message.payload !== 'object' || message.payload === null) return false;

  const payload = message.payload as Record<string, unknown>;

  switch (message.type) {
    case 'core.notify':
      return typeof payload.titulo === 'string' && typeof payload.corpo === 'string';
    case 'core.fs.read':
    case 'core.fs.write':
      return typeof payload.caminho === 'string';
    case 'core.fs.list':
      return typeof payload.caminho === 'string';
    case 'core.fetch':
      return typeof payload.url === 'string';
    case 'core.automation.run':
      return typeof payload.nome === 'string';
    case 'core.window.open':
      return typeof payload.app === 'string';
    case 'core.command.register':
      return typeof payload.id === 'string' && typeof payload.nome === 'string' && typeof payload.descricao === 'string';
    case 'core.event.subscribe':
      return typeof payload.evento === 'string';
    default:
      return false;
  }
}
