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

// ─── Armazenamento (guardar preferências) — plugins.storage (11/08/2026) ──

export interface PluginStorageSetRequest {
  readonly type: 'core.storage.set';
  readonly requestId: string;
  readonly payload: {
    /** Chave — o Core aplica o prefixo `plugins:<id>:` automaticamente. */
    readonly chave: string;
    readonly valor: unknown;
  };
}

export interface PluginStorageGetRequest {
  readonly type: 'core.storage.get';
  readonly requestId: string;
  readonly payload: {
    readonly chave: string;
    /** Valor devolvido quando a chave não existe. */
    readonly fallback?: unknown;
  };
}

export interface PluginStorageRemoveRequest {
  readonly type: 'core.storage.remove';
  readonly requestId: string;
  readonly payload: {
    readonly chave: string;
  };
}

// ─── Atalhos (registar atalhos de teclado) — plugins.shortcuts (11/08/2026)

export interface PluginShortcutRegisterRequest {
  readonly type: 'core.shortcut.register';
  readonly requestId: string;
  readonly payload: {
    readonly id: string;
    /** Tecla principal (ex.: 's', 'F1'). */
    readonly key: string;
    readonly ctrlOrMeta?: boolean;
    readonly shift?: boolean;
    readonly alt?: boolean;
  };
}

// ─── Widgets (título + texto, nunca código nem markup) — plugins.widgets ───

export interface PluginWidgetCreateRequest {
  readonly type: 'core.widget.create';
  readonly requestId: string;
  readonly payload: {
    /** Identificador do widget, único dentro do próprio plugin. */
    readonly id: string;
    readonly titulo: string;
    readonly texto: string;
  };
}

// ─── Menus (item no menu de contexto do ambiente) — plugins.menus ─────────

export interface PluginMenuAddRequest {
  readonly type: 'core.menu.add';
  readonly requestId: string;
  readonly payload: {
    readonly id: string;
    readonly rotulo: string;
  };
}

// ─── Configurações (schema; o valor vive no armazenamento) — plugins.settings

export type PluginSettingType = 'boolean' | 'texto';

export interface PluginSettingRegisterRequest {
  readonly type: 'core.setting.register';
  readonly requestId: string;
  readonly payload: {
    readonly chave: string;
    readonly rotulo: string;
    readonly tipo: PluginSettingType;
    readonly valorOmissao: boolean | string;
  };
}

// ─── Serviços (o Core empurra um "tick" a um intervalo) — plugins.services ─

export interface PluginServiceRegisterRequest {
  readonly type: 'core.service.register';
  readonly requestId: string;
  readonly payload: {
    readonly id: string;
    /** Milissegundos entre "ticks" — o Core aplica um mínimo (ver plugin-bridge.ts). */
    readonly intervalMs: number;
  };
}

// ─── Painéis (bloco de texto expansível) — plugins.panels ─────────────────

export interface PluginPanelAddRequest {
  readonly type: 'core.panel.add';
  readonly requestId: string;
  readonly payload: {
    readonly id: string;
    readonly titulo: string;
    readonly texto: string;
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
  | PluginEventSubscribeRequest
  | PluginStorageSetRequest
  | PluginStorageGetRequest
  | PluginStorageRemoveRequest
  | PluginShortcutRegisterRequest
  | PluginWidgetCreateRequest
  | PluginMenuAddRequest
  | PluginSettingRegisterRequest
  | PluginServiceRegisterRequest
  | PluginPanelAddRequest;

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
  'core.storage.set': 'storage',
  'core.storage.get': 'storage',
  'core.storage.remove': 'storage',
  'core.shortcut.register': 'shortcuts',
  'core.widget.create': 'widgets',
  'core.menu.add': 'menus',
  'core.setting.register': 'settings',
  'core.service.register': 'services',
  'core.panel.add': 'panels',
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
  'core.storage.set',
  'core.storage.get',
  'core.storage.remove',
  'core.shortcut.register',
  'core.widget.create',
  'core.menu.add',
  'core.setting.register',
  'core.service.register',
  'core.panel.add',
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
    case 'core.fs.list':
      return typeof payload.caminho === 'string';
    case 'core.fs.write':
      return typeof payload.caminho === 'string' && typeof payload.conteudo === 'string';
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
    case 'core.storage.set':
    case 'core.storage.get':
      return typeof payload.chave === 'string';
    case 'core.storage.remove':
      return typeof payload.chave === 'string';
    case 'core.shortcut.register':
      return typeof payload.id === 'string' && typeof payload.key === 'string';
    case 'core.widget.create':
      return (
        typeof payload.id === 'string' &&
        typeof payload.titulo === 'string' &&
        typeof payload.texto === 'string'
      );
    case 'core.menu.add':
      return typeof payload.id === 'string' && typeof payload.rotulo === 'string';
    case 'core.setting.register':
      return (
        typeof payload.chave === 'string' &&
        typeof payload.rotulo === 'string' &&
        (payload.tipo === 'boolean' || payload.tipo === 'texto') &&
        (typeof payload.valorOmissao === 'boolean' || typeof payload.valorOmissao === 'string')
      );
    case 'core.service.register':
      return typeof payload.id === 'string' && typeof payload.intervalMs === 'number';
    case 'core.panel.add':
      return (
        typeof payload.id === 'string' &&
        typeof payload.titulo === 'string' &&
        typeof payload.texto === 'string'
      );
    default:
      return false;
  }
}
