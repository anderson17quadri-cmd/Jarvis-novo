import { APP_REGISTRY } from '@/apps/registry';
import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { loadExternalPlugin } from '@/plugins/external-storage';
import type { PluginPermissions } from '@/plugins/plugin';
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

// ─── Alcance de cada plugin a correr ─────────────────────────────────────────

/**
 * Como falar com o iframe de um plugin a partir de fora do fluxo normal de
 * mensagens — atalhos, itens de menu e "ticks" de serviço não nascem de um
 * pedido do próprio plugin, por isso não há nenhum `sendToPlugin` à mão como
 * há para `core.event.subscribe`.
 *
 * `PluginRuntime` regista-se aqui ao montar e desregista-se ao desmontar. Sem
 * isto, um atalho premido nunca chegava ao plugin: `window.postMessage` no
 * `window` do Core não entra num iframe filho sozinho, e nada mais na cadeia
 * o reencaminhava — um buraco real, só visível ao testar a sério (prima a
 * tecla, o plugin nunca reage).
 */
type PluginSender = (message: Record<string, unknown>) => void;

const pluginSenders = new Map<string, PluginSender>();

export function registerPluginSender(pluginId: string, send: PluginSender): void {
  pluginSenders.set(pluginId, send);
}

export function unregisterPluginSender(pluginId: string): void {
  pluginSenders.delete(pluginId);
}

/** Empurra uma mensagem para um plugin a correr. `false` se não estiver montado. */
export function pushToPlugin(pluginId: string, message: Record<string, unknown>): boolean {
  const send = pluginSenders.get(pluginId);
  if (!send) return false;
  send(message);
  return true;
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

// ─── Widgets registados por plugins ──────────────────────────────────────────

export interface PluginWidget {
  readonly pluginId: string;
  readonly id: string;
  readonly titulo: string;
  readonly texto: string;
}

const pluginWidgets: PluginWidget[] = [];

/** Widgets de um plugin — para `PluginRuntime` os mostrar depois de os criar. */
export function getPluginWidgets(pluginId: string): readonly PluginWidget[] {
  return pluginWidgets.filter((w) => w.pluginId === pluginId);
}

/** Remove todos os widgets de um plugin — chamado ao desmontar. */
export function clearPluginWidgets(pluginId: string): void {
  for (let i = pluginWidgets.length - 1; i >= 0; i--) {
    if (pluginWidgets[i]?.pluginId === pluginId) pluginWidgets.splice(i, 1);
  }
}

// ─── Itens de menu registados por plugins ────────────────────────────────────

export interface PluginMenuItem {
  readonly pluginId: string;
  readonly id: string;
  readonly rotulo: string;
}

const pluginMenuItems: PluginMenuItem[] = [];

/** Todos os itens de menu de todos os plugins — para `DesktopContextMenu`. */
export function getPluginMenuItems(): readonly PluginMenuItem[] {
  return pluginMenuItems;
}

/** Remove todos os itens de menu de um plugin — chamado ao desmontar. */
export function clearPluginMenuItems(pluginId: string): void {
  for (let i = pluginMenuItems.length - 1; i >= 0; i--) {
    if (pluginMenuItems[i]?.pluginId === pluginId) pluginMenuItems.splice(i, 1);
  }
}

// ─── Definições registadas por plugins ───────────────────────────────────────

export interface PluginSetting {
  readonly pluginId: string;
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo: 'boolean' | 'texto';
  readonly valorOmissao: boolean | string;
}

const pluginSettings: PluginSetting[] = [];

/** O schema das definições de um plugin — o valor vive no armazenamento. */
export function getPluginSettings(pluginId: string): readonly PluginSetting[] {
  return pluginSettings.filter((s) => s.pluginId === pluginId);
}

/** Remove o schema das definições de um plugin — chamado ao desmontar. */
export function clearPluginSettings(pluginId: string): void {
  for (let i = pluginSettings.length - 1; i >= 0; i--) {
    if (pluginSettings[i]?.pluginId === pluginId) pluginSettings.splice(i, 1);
  }
}

/**
 * Lê/escreve o valor de uma definição — a mesma chave prefixada de
 * `core.storage`, mas chamada diretamente do lado do Core (confia-se em si
 * própria) em vez de ir e voltar pelo protocolo do plugin, que é para quem
 * está de fora da sandbox, não para a própria interface de definições.
 */
export async function getPluginSettingValue<T extends boolean | string>(
  pluginId: string,
  chave: string,
  fallback: T,
): Promise<T> {
  return getPlatformAdapter().storageGet<T>(`plugins:${pluginId}:${chave}`, fallback);
}

export async function setPluginSettingValue(
  pluginId: string,
  chave: string,
  valor: boolean | string,
): Promise<void> {
  await getPlatformAdapter().storageSet(`plugins:${pluginId}:${chave}`, valor);
}

// ─── Serviços registados por plugins ─────────────────────────────────────────

interface PluginService {
  pluginId: string;
  id: string;
  intervalId: ReturnType<typeof setInterval>;
}

const pluginServices: PluginService[] = [];

/** Nunca mais depressa do que isto — um plugin não pode martelar o Core. */
const MIN_SERVICE_INTERVAL_MS = 5_000;

/** Remove (e para) todos os serviços de um plugin — chamado ao desmontar. */
export function clearPluginServices(pluginId: string): void {
  for (let i = pluginServices.length - 1; i >= 0; i--) {
    const service = pluginServices[i];
    if (!service) continue;
    if (service.pluginId === pluginId) {
      clearInterval(service.intervalId);
      pluginServices.splice(i, 1);
    }
  }
}

/** Quantos serviços um plugin tem ativos — só para a interface o mostrar. */
export function getPluginServiceCount(pluginId: string): number {
  return pluginServices.filter((s) => s.pluginId === pluginId).length;
}

// ─── Painéis registados por plugins ──────────────────────────────────────────

export interface PluginPanel {
  readonly pluginId: string;
  readonly id: string;
  readonly titulo: string;
  readonly texto: string;
}

const pluginPanels: PluginPanel[] = [];

/** Painéis de um plugin — para `PluginRuntime` os mostrar depois de os criar. */
export function getPluginPanels(pluginId: string): readonly PluginPanel[] {
  return pluginPanels.filter((p) => p.pluginId === pluginId);
}

/** Remove todos os painéis de um plugin — chamado ao desmontar. */
export function clearPluginPanels(pluginId: string): void {
  for (let i = pluginPanels.length - 1; i >= 0; i--) {
    if (pluginPanels[i]?.pluginId === pluginId) pluginPanels.splice(i, 1);
  }
}

// ─── Ponte ──────────────────────────────────────────────────────────────────

interface PluginDeclaration {
  readonly permissions: PluginPermissions | undefined;
  readonly filesystemRoot: string | undefined;
  readonly allowedDomains: readonly string[] | undefined;
}

/**
 * O que um plugin declara de si — permissões e âmbito de ficheiros/rede.
 *
 * Procura primeiro no armazenamento de plugins externos: um plugin instalado
 * de ficheiro responde pelo seu próprio manifesto (o assinado), nunca por uma
 * entrada do catálogo que calhe ter o mesmo id. Só depois cai para o catálogo.
 */
function resolveDeclaration(pluginId: string): PluginDeclaration {
  const external = loadExternalPlugin(pluginId);
  if (external) {
    return {
      permissions: external.manifest.permissions,
      filesystemRoot: undefined,
      allowedDomains: undefined,
    };
  }

  const entry = PLUGIN_CATALOG.find((candidate) => candidate.id === pluginId);
  return {
    permissions: entry?.permissions,
    filesystemRoot: entry?.filesystemRoot,
    allowedDomains: entry?.allowedDomains,
  };
}

/**
 * Decide o que fazer com um pedido de um plugin, e fá-lo.
 *
 * Separado do `<iframe>` de propósito: esta função não sabe nada de DOM, por
 * isso testa-se sem montar nada. A verificação de permissão tem dois degraus:
 * a capacidade tem de estar **declarada no manifesto** do próprio plugin
 * (permissão `true`), e não pode ter sido **recusada** em Privacidade —
 * `selectPermissionDenied` sobre o estado real de `use-plugin-store.ts`.
 * A declaração do manifesto é a fronteira que torna a assinatura (que cobre
 * só o manifesto) suficiente para limitar o código: um plugin assinado com um
 * manifesto estreito não pode pedir capacidades que não declarou.
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
  const declaration = resolveDeclaration(pluginId);

  if (!declaration.permissions?.[permission]) {
    logService.audit(`Plugin ${pluginId}: ${message.type}`, 'recusado');
    return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'permissao-nao-declarada' };
  }

  if (selectPermissionDenied(usePluginStore.getState(), pluginId, permission)) {
    logService.audit(`Plugin ${pluginId}: ${message.type}`, 'recusado');
    return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'permissao-negada' };
  }

  switch (message.type) {
    case 'core.notify':
      notificationService.info(message.payload.titulo, message.payload.corpo, {
        category: 'plugins',
      });
      break;

    case 'core.fs.read': {
      if (!declaration.filesystemRoot) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-raiz-declarada' };
      }
      return await handleFsRead(declaration.filesystemRoot, message.payload.caminho, message.requestId);
    }

    case 'core.fs.write': {
      if (!declaration.filesystemRoot) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-raiz-declarada' };
      }
      return await handleFsWrite(declaration.filesystemRoot, message.payload.caminho, message.payload.conteudo, message.requestId);
    }

    case 'core.fs.list': {
      if (!declaration.filesystemRoot) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-raiz-declarada' };
      }
      return await handleFsList(declaration.filesystemRoot, message.payload.caminho, message.requestId);
    }

    case 'core.fetch': {
      if (!declaration.allowedDomains || declaration.allowedDomains.length === 0) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'sem-dominios-autorizados' };
      }
      return await handlePluginFetch(declaration.allowedDomains, message.payload, message.requestId);
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

    case 'core.widget.create': {
      const { id, titulo, texto } = message.payload;
      const existing = pluginWidgets.findIndex((w) => w.pluginId === pluginId && w.id === id);
      const widget: PluginWidget = { pluginId, id, titulo, texto };
      if (existing >= 0) {
        pluginWidgets[existing] = widget;
      } else {
        pluginWidgets.push(widget);
      }
      logService.audit(`Plugin ${pluginId}: criou o widget ${id}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }

    case 'core.menu.add': {
      const { id, rotulo } = message.payload;
      if (pluginMenuItems.some((m) => m.pluginId === pluginId && m.id === id)) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'item-ja-registado' };
      }
      pluginMenuItems.push({ pluginId, id, rotulo });
      logService.audit(`Plugin ${pluginId}: adicionou o item de menu ${id}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }

    case 'core.setting.register': {
      const { chave, rotulo, tipo, valorOmissao } = message.payload;
      const existing = pluginSettings.findIndex((s) => s.pluginId === pluginId && s.chave === chave);
      const setting: PluginSetting = { pluginId, chave, rotulo, tipo, valorOmissao };
      if (existing >= 0) {
        pluginSettings[existing] = setting;
      } else {
        pluginSettings.push(setting);
      }
      // Só semeia o valor por omissão se ainda não houver nada guardado —
      // reabrir o plugin não pode apagar o que a pessoa já escolheu.
      const prefixedKey = `plugins:${pluginId}:${chave}`;
      const jaTinhaValor = (await getPlatformAdapter().storageGet<unknown>(prefixedKey, null)) !== null;
      if (!jaTinhaValor) {
        await getPlatformAdapter().storageSet(prefixedKey, valorOmissao);
      }
      logService.audit(`Plugin ${pluginId}: registou a definição ${chave}`, 'executado');
      return { type: 'core.ack', requestId: message.requestId, ok: true };
    }

    case 'core.service.register': {
      const { id, intervalMs } = message.payload;
      if (pluginServices.some((s) => s.pluginId === pluginId && s.id === id)) {
        return { type: 'core.ack', requestId: message.requestId, ok: false, reason: 'servico-ja-registado' };
      }

      // `intervalMs` vem de um plugin (não é de confiança): um `NaN` passa na
      // validação do protocolo (`typeof NaN` é "number") mas `Math.max` devolve
      // `NaN`, e `setInterval(cb, NaN)` dispara em 0ms — uma martelada ao Core.
      // Tudo o que não for um número finito cai no mínimo, como um pedido de 0ms.
      const intervaloReal = Math.max(Number.isFinite(intervalMs) ? intervalMs : 0, MIN_SERVICE_INTERVAL_MS);
      const intervalId = setInterval(() => {
        pushToPlugin(pluginId, { type: 'core.service.tick', id });
      }, intervaloReal);

      pluginServices.push({ pluginId, id, intervalId });
      logService.audit(
        `Plugin ${pluginId}: registou o serviço ${id} (a cada ${intervaloReal}ms)`,
        'executado',
      );
      return { type: 'core.ack', requestId: message.requestId, ok: true, data: { intervalMs: intervaloReal } };
    }

    case 'core.panel.add': {
      const { id, titulo, texto } = message.payload;
      const existing = pluginPanels.findIndex((p) => p.pluginId === pluginId && p.id === id);
      const panel: PluginPanel = { pluginId, id, titulo, texto };
      if (existing >= 0) {
        pluginPanels[existing] = panel;
      } else {
        pluginPanels.push(panel);
      }
      logService.audit(`Plugin ${pluginId}: adicionou o painel ${id}`, 'executado');
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
 * Junta a raiz do plugin ao caminho que ele pediu. Rejeita `..` e caminhos
 * absolutos — sem isto, um plugin poderia pedir `../../outra-pasta/segredo.txt`
 * ou `C:\...\segredo.txt` e sair da sua própria pasta apesar de
 * `filesystemRoot` dizer o contrário (o `join` de baixo substitui a base
 * quando o caminho é absoluto).
 */
async function resolveWithinRoot(root: string, caminho: string): Promise<string> {
  if (caminho.split(/[/\\]+/).includes('..')) {
    throw new Error('caminho tenta sair da pasta do plugin');
  }
  const { isAbsolute, join } = await import('@tauri-apps/api/path');
  if (await isAbsolute(caminho)) {
    throw new Error('caminho tem de ser relativo à pasta do plugin');
  }
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
    // `redirect: 'manual'` — a verificação do domínio é só sobre a URL *inicial*;
    // deixar o `fetch` seguir redireccionamentos por conta própria deixava um
    // domínio autorizado apontar para `localhost`/IP privado e ler a resposta.
    // Com `manual`, o browser não segue nada: o plugin recebe a recusa e decide.
    const init: RequestInit = { method: payload.metodo ?? 'GET', redirect: 'manual' };
    if (payload.cabecalhos) init.headers = payload.cabecalhos;
    if (payload.corpo !== undefined) init.body = payload.corpo;

    const resposta = await fetch(payload.url, init);
    if (resposta.type === 'opaqueredirect') {
      return { type: 'core.ack', requestId, ok: false, reason: 'redireccionamento-nao-seguido' };
    }
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
