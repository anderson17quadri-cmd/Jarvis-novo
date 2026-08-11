import { APP_REGISTRY } from '@/apps/registry';
import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { automationService } from '@/services/automation-service';
import { ALL_EVENTS, eventBus, type SystemEventName } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { getPlatformAdapter } from '@/platform';
import { selectPermissionDenied, usePluginStore } from '@/stores/use-plugin-store';
import { useWindowStore } from '@/stores/use-window-store';
import type { AppId } from '@/types/app';
import type { WindowRect } from '@/types/window';
import {
  PERMISSION_BY_MESSAGE_TYPE,
  type CoreAckMessage,
  type PluginToCoreMessage,
} from './protocol';

// ─── Comandos registados por plugins ────────────────────────────────────────

export interface PluginCommand {
  readonly pluginId: string;
  readonly id: string;
  readonly nome: string;
  readonly descricao: string;
}

const pluginCommands: PluginCommand[] = [];

/** Comandos que plugins registaram na paleta — para `command-registry.ts`. */
export function getPluginCommands(): readonly PluginCommand[] {
  return pluginCommands;
}

/** Remove todos os comandos registados — para testes. */
export function clearPluginCommands(): void {
  pluginCommands.length = 0;
}

// ─── Atalhos registados por plugins ──────────────────────────────────────────

export interface PluginShortcut {
  readonly pluginId: string;
  readonly id: string;
  readonly key: string;
  readonly ctrlOrMeta: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

const pluginShortcuts: PluginShortcut[] = [];

/** Atalhos que plugins registaram — para `App.tsx` os ouvir. */
export function getPluginShortcuts(): readonly PluginShortcut[] {
  return pluginShortcuts;
}

/** Remove todos os atalhos de um plugin. */
export function clearPluginShortcuts(pluginId: string): void {
  for (let i = pluginShortcuts.length - 1; i >= 0; i--) {
    if (pluginShortcuts[i]?.pluginId === pluginId) pluginShortcuts.splice(i, 1);
  }
}

/** Remove todos os atalhos registados — para testes. */
export function clearAllPluginShortcuts(): void {
  pluginShortcuts.length = 0;
}

/** Atalhos reservados do sistema — plugins nunca podem usurpá-los. */
const RESERVED_SHORTCUTS = new Set([
  'k',  // Command Palette (Ctrl+K)
  'e',  // Emails (Ctrl+E)
  't',  // Tarefas (Ctrl+T)
  'p',  // Projetos (Ctrl+P)
  'm',  // microfone
]);

function isReservedShortcut(key: string, ctrl: boolean): boolean {
  return ctrl && RESERVED_SHORTCUTS.has(key.toLowerCase());
}

// ─── Subscrições de eventos ─────────────────────────────────────────────────

interface PluginEventSubscription {
  pluginId: string;
  evento: SystemEventName;
  unsubscribe: () => void;
}

const eventSubscriptions: PluginEventSubscription[] = [];

/**
 * Remove todas as subscrições de eventos de um plugin.
 *
 * Chamado pelo `PluginRuntime` quando o componente desmonta — sem isto, um
 * plugin que deixasse de correr continuava a receber eventos para sempre.
 */
export function clearPluginSubscriptions(pluginId: string): void {
  for (let i = eventSubscriptions.length - 1; i >= 0; i--) {
    const sub = eventSubscriptions[i];
    if (!sub) continue;
    if (sub.pluginId === pluginId) {
      sub.unsubscribe();
      eventSubscriptions.splice(i, 1);
    }
  }
}

// ─── Ponte ──────────────────────────────────────────────────────────────────

/**
 * Decide o que fazer com um pedido de um plugin, e fá-lo.
 *
 * Separado do `<iframe>` de propósito: esta função não sabe nada de DOM, por
 * isso testa-se sem montar nada. A verificação de permissão é a mesma
 * usada em `App.tsx` (automações) e `ai-service.ts` (rede) — nunca decorativa,
 * sempre `selectPermissionDenied` sobre o estado real de `use-plugin-store.ts`.
 *
 * `sendToPlugin` é opcional: só as capacidades que empurram dados para o
 * plugin de forma assíncrona (eventos) precisam dele. As outras funcionam
 * com a resposta síncrona do `ack`.
 *
 * Devolve sempre uma Promise — as capacidades de ficheiros e rede são
 * assíncronas, e as síncronas (notificações) resolvem-se no próprio tick.
 */
export async function handlePluginMessage(
  pluginId: string,
  message: PluginToCoreMessage,
  sendToPlugin?: (message: Record<string, unknown>) => void,
): Promise<CoreAckMessage> {
  const permission = PERMISSION_BY_MESSAGE_TYPE[message.type];
  const isDenied = selectPermissionDenied(usePluginStore.getState(), pluginId, permission);

  if (isDenied) {
    logService.audit(`Plugin ${pluginId}: ${message.type}`, 'recusado');
    return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'permissao-negada' };
  }

  const entry = PLUGIN_CATALOG.find((candidate) => candidate.id === pluginId);

  switch (message.type) {
    case 'core.notify':
      notificationService.info(message.payload.titulo, message.payload.corpo, {
        category: 'plugins',
      });
      break;

    case 'core.fs.read': {
      if (!entry?.filesystemRoot) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-raiz-declarada' };
      }
      return await handleFsRead(entry.filesystemRoot, message.payload.caminho, message.requestId);
    }

    case 'core.fs.write': {
      if (!entry?.filesystemRoot) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-raiz-declarada' };
      }
      return await handleFsWrite(entry.filesystemRoot, message.payload.caminho, message.payload.conteudo, message.requestId);
    }

    case 'core.fs.list': {
      if (!entry?.filesystemRoot) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-raiz-declarada' };
      }
      return await handleFsList(entry.filesystemRoot, message.payload.caminho, message.requestId);
    }

    case 'core.fetch': {
      if (!entry?.allowedDomains || entry.allowedDomains.length === 0) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-dominios-autorizados' };
      }
      return await handlePluginFetch(entry.allowedDomains, message.payload, message.requestId);
    }

    case 'core.automation.run': {
      const automation = automationService.list.find((a) => a.name === message.payload.nome);
      if (!automation) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'automação-não-encontrada' };
      }
      const run = automationService.run(automation.id);
      logService.audit(`Plugin ${pluginId}: ${message.type}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: run !== null, data: { runId: run?.id } };
    }

    case 'core.window.open': {
      const appId = message.payload.app as AppId;
      const definition = APP_REGISTRY[appId];
      if (!definition) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'app-desconhecida' };
      }
      if (!definition.implemented) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'app-por-implementar' };
      }
      const titulo = message.payload.titulo ?? definition.title;
      const rect: WindowRect = {
        x: 120,
        y: 80,
        width: definition.defaultSize.width,
        height: definition.defaultSize.height,
      };
      const windowId = useWindowStore.getState().open(appId, titulo, rect);
      logService.audit(`Plugin ${pluginId}: abriu janela ${appId}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true, data: { windowId } };
    }

    case 'core.command.register': {
      // Um plugin não pode registar o mesmo ID duas vezes.
      if (pluginCommands.some((c) => c.pluginId === pluginId && c.id === message.payload.id)) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'comando-ja-registado' };
      }
      pluginCommands.push({
        pluginId,
        id: message.payload.id,
        nome: message.payload.nome,
        descricao: message.payload.descricao,
      });
      logService.audit(`Plugin ${pluginId}: registou comando ${message.payload.id}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }

    case 'core.event.subscribe': {
      const evento = message.payload.evento;
      // Só eventos que existem no barramento — nomes inventados são recusados.
      if (!(ALL_EVENTS as readonly string[]).includes(evento)) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'evento-desconhecido' };
      }

      const subscriptionId = `sub-${pluginId}-${evento}-${Date.now()}`;

      if (sendToPlugin) {
        const unsubscribe = eventBus.on(evento as SystemEventName, (payload) => {
          sendToPlugin({
            type: 'core.event',
            subscriptionId,
            evento,
            payload,
          });
        });

        eventSubscriptions.push({ pluginId, evento: evento as SystemEventName, unsubscribe });
      }

      logService.audit(`Plugin ${pluginId}: subscreveu evento ${evento}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true, data: { subscriptionId } };
    }

    case 'core.storage.set': {
      const prefixedKey = `plugins:${pluginId}:${message.payload.chave}`;
      await getPlatformAdapter().storageSet(prefixedKey, message.payload.valor);
      logService.audit(`Plugin ${pluginId}: storage.set ${message.payload.chave}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }

    case 'core.storage.get': {
      const prefixedKey = `plugins:${pluginId}:${message.payload.chave}`;
      const valor = await getPlatformAdapter().storageGet<unknown>(prefixedKey, message.payload.fallback ?? null);
      return { type: 'core.ack', requestId: message.requestId, ok: true, data: { valor } };
    }

    case 'core.storage.remove': {
      const prefixedKey = `plugins:${pluginId}:${message.payload.chave}`;
      await getPlatformAdapter().storageRemove(prefixedKey);
      logService.audit(`Plugin ${pluginId}: storage.remove ${message.payload.chave}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }

    case 'core.shortcut.register': {
      const { id, key, ctrlOrMeta = false, shift = false, alt = false } = message.payload;

      // Duplicados do mesmo plugin são recusados.
      if (pluginShortcuts.some((s) => s.pluginId === pluginId && s.id === id)) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'atalho-ja-registado' };
      }

      // Atalhos reservados do sistema não se cedem a plugins.
      if (isReservedShortcut(key, ctrlOrMeta)) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'atalho-reservado' };
      }

      pluginShortcuts.push({ pluginId, id, key, ctrlOrMeta, shift, alt });
      logService.audit(`Plugin ${pluginId}: registou atalho ${id}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }
  }

  logService.audit(`Plugin ${pluginId}: ${message.type}`, 'executado');
  return { type: 'core.ack', requestId: message.requestId, ok: true };
}

// ─── Ficheiros ────────────────────────────────────────────────────────────

/**
 * A pasta real de um plugin, dentro dos dados da app.
 *
 * `filesystemRoot` no catálogo é só o nome da subpasta (ex.: "ola-notificacao")
 * — nunca um caminho absoluto. É resolvido aqui, sempre dentro de
 * `$APPDATA/plugins-data/`, que é o único sítio para onde `fs:allow-*` no
 * `default.json` dá licença de escrever. Um plugin nunca vê nem escolhe o
 * caminho absoluto — só o que está *dentro* da sua própria pasta.
 */
async function resolvePluginRoot(root: string): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return join(await appDataDir(), 'plugins-data', root);
}

/**
 * Junta a raiz do plugin ao caminho que ele pediu. Rejeita `..` — sem isto,
 * um plugin poderia pedir `../../outra-pasta/segredo.txt` e sair da sua
 * própria pasta apesar de `filesystemRoot` dizer o contrário.
 */
async function resolveWithinRoot(root: string, caminho: string): Promise<string> {
  if (caminho.split(/[/\\]+/).includes('..')) {
    throw new Error('caminho tenta sair da pasta do plugin');
  }
  const { join } = await import('@tauri-apps/api/path');
  const base = await resolvePluginRoot(root);
  return join(base, caminho);
}

async function handleFsRead(root: string, caminho: string, requestId: string): Promise<CoreAckMessage> {
  try {
    const fullPath = await resolveWithinRoot(root, caminho);
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const content = await readTextFile(fullPath);
    return { type: 'core.ack', requestId, ok: true, data: { conteudo: content } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro-desconhecido';
    return { type: 'core.ack', requestId, ok: false, reason: `fs-read: ${message}` };
  }
}

async function handleFsWrite(root: string, caminho: string, conteudo: string, requestId: string): Promise<CoreAckMessage> {
  try {
    const fullPath = await resolveWithinRoot(root, caminho);
    const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
    const base = await resolvePluginRoot(root);
    await mkdir(base, { recursive: true }).catch(() => undefined);
    await writeTextFile(fullPath, conteudo);
    return { type: 'core.ack', requestId, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro-desconhecido';
    return { type: 'core.ack', requestId, ok: false, reason: `fs-write: ${message}` };
  }
}

async function handleFsList(root: string, caminho: string, requestId: string): Promise<CoreAckMessage> {
  try {
    const fullPath = caminho ? await resolveWithinRoot(root, caminho) : await resolvePluginRoot(root);
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(fullPath);
    const files = entries.map((entry) => ({
      nome: entry.name,
      isDir: entry.isDirectory ?? false,
    }));
    return { type: 'core.ack', requestId, ok: true, data: { ficheiros: files } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro-desconhecido';
    return { type: 'core.ack', requestId, ok: false, reason: `fs-list: ${message}` };
  }
}

// ─── Rede ─────────────────────────────────────────────────────────────────

async function handlePluginFetch(
  allowedDomains: readonly string[],
  payload: { url: string; metodo?: string; cabecalhos?: Record<string, string>; corpo?: string },
  requestId: string,
): Promise<CoreAckMessage> {
  let hostname: string;
  try {
    hostname = new URL(payload.url).hostname;
  } catch {
    return { type: 'core.ack', requestId, ok: false, reason: 'url-invalida' };
  }

  if (!allowedDomains.includes(hostname)) {
    return { type: 'core.ack', requestId, ok: false, reason: `dominio-nao-autorizado: ${hostname}` };
  }

  try {
    const init: RequestInit = { method: payload.metodo ?? 'GET' };
    if (payload.cabecalhos) init.headers = payload.cabecalhos;
    if (payload.corpo !== undefined) init.body = payload.corpo;

    const resposta = await fetch(payload.url, init);
    const texto = await resposta.text();
    return {
      type: 'core.ack',
      requestId,
      ok: resposta.ok,
      data: { status: resposta.status, corpo: texto },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro-desconhecido';
    return { type: 'core.ack', requestId, ok: false, reason: `fetch: ${message}` };
  }
}
