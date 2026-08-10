import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { automationService } from '@/services/automation-service';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { selectPermissionDenied, usePluginStore } from '@/stores/use-plugin-store';
import {
  PERMISSION_BY_MESSAGE_TYPE,
  type CoreAckMessage,
  type PluginToCoreMessage,
} from './protocol';

/**
 * Decide o que fazer com um pedido de um plugin, e fá-lo.
 *
 * Separado do `<iframe>` de propósito: esta função não sabe nada de DOM, por
 * isso testa-se sem montar nada. A verificação de permissão é a mesma
 * usada em `App.tsx` (automações) e `ai-service.ts` (rede) — nunca decorativa,
 * sempre `selectPermissionDenied` sobre o estado real de `use-plugin-store.ts`.
 *
 * Devolve sempre uma Promise — as capacidades de ficheiros e rede são
 * assíncronas, e as síncronas (notificações) resolvem-se no próprio tick.
 */
export async function handlePluginMessage(
  pluginId: string,
  message: PluginToCoreMessage,
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
