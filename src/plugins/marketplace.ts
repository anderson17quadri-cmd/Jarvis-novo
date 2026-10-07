import { PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { usePluginStore } from '@/stores/use-plugin-store';
import { logService } from '@/services/log-service';
import { loadExternalPlugin, removeExternalPlugin, saveExternalPlugin } from './external-storage';
import { validateManifest, validatePackage } from './install-from-file';
import { getPluginRuntime, registerPluginRuntime, unregisterPluginRuntime } from './runtime/registry';
import { verifySignedPluginPackage } from './signature';
import type { PluginPackage } from './plugin';

export const MARKETPLACE_SOURCE_KEY = 'jarvis.marketplace-source';
const PREVIOUS_KEY = 'jarvis.plugin-previous:';
export interface RemotePluginListing {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly downloadUrl: string;
  readonly sha256: string;
}

function sourceUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('O URL do índice não é válido.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com' || url.port ||
    url.username || url.password || url.search || url.hash || url.pathname.split('/').filter(Boolean).length < 4) {
    throw new Error('Usa o URL público raw.githubusercontent.com de um índice GitHub, sem credenciais ou parâmetros.');
  }
  return url;
}
function sameRepository(raw: string, source: string): string {
  const url = sourceUrl(raw);
  if (url.pathname.split('/').slice(1, 3).join('/') !== sourceUrl(source).pathname.split('/').slice(1, 3).join('/')) {
    throw new Error('O pacote deve vir do mesmo repositório GitHub que o índice.');
  }
  return url.href;
}

async function download(raw: string, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const url = sourceUrl(raw).href;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), credentials: 'omit', redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Não consegui descarregar o ficheiro (HTTP ${response.status}).`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error('O ficheiro excede o tamanho permitido.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function loadMarketplace(source: string): Promise<readonly RemotePluginListing[]> {
  const bytes = await download(source, 256 * 1024);
  const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 ||
    !('plugins' in data) || !Array.isArray(data.plugins) || data.plugins.length > 100) throw new Error('O índice não tem um formato válido (version: 1, plugins: até 100 entradas).');
  const ids = new Set<string>();
  return (data.plugins as unknown[]).map(value => {
    if (!value || typeof value !== 'object') throw new Error('Há uma entrada inválida no índice.');
    const entry = value as Record<string, unknown>;
    for (const key of ['id', 'name', 'version', 'author', 'downloadUrl', 'sha256']) {
      if (typeof entry[key] !== 'string' || !entry[key] || entry[key].length > 2048) throw new Error('Falta um campo válido no índice.');
    }
    const listing = entry as unknown as RemotePluginListing;
    if (!/^[a-z0-9_-]+$/.test(listing.id) || ids.has(listing.id) || !/^[a-f0-9]{64}$/.test(listing.sha256)) {
      throw new Error('O índice tem identificadores repetidos ou um hash inválido.');
    }
    ids.add(listing.id);
    sameRepository(listing.downloadUrl, source);
    return listing;
  });
}

async function verify(pkg: PluginPackage): Promise<void> {
  const error = validateManifest(pkg.manifest);
  if (error) throw new Error(error);
  if (PLUGIN_CATALOG.some(entry => entry.id === pkg.manifest.id)) throw new Error('Um pacote remoto não pode substituir plugins do catálogo do sistema.');
  if (await verifySignedPluginPackage(pkg) !== 'assinado-valido') throw new Error('A assinatura do pacote é inválida ou a chave foi revogada.');
}

export async function prepareMarketplacePackage(listing: RemotePluginListing, source: string): Promise<PluginPackage> {
  const bytes = await download(sameRepository(listing.downloadUrl, source), 2 * 1024 * 1024);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== listing.sha256) throw new Error('O hash do pacote não corresponde ao índice.');
  const pkg = validatePackage(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  if (pkg.manifest.id !== listing.id || pkg.manifest.version !== listing.version) throw new Error('O pacote não corresponde ao identificador e versão do índice.');
  await verify(pkg);
  return pkg;
}

export function hasMarketplaceRollback(id: string): boolean { return localStorage.getItem(`${PREVIOUS_KEY}${id}`) !== null; }

let changing = false;
/** Atualizações e rollback ficam desativados até a pessoa os ativar novamente. */
export async function applyMarketplacePackage(input: PluginPackage): Promise<void> {
  if (changing) throw new Error('Já há uma instalação em curso.');
  changing = true;
  try {
    const pkg = validatePackage(input);
    await verify(pkg);
    const id = pkg.manifest.id;
    const previous = loadExternalPlugin(id);
    if (previous && previous.signerPublicKey !== pkg.signerPublicKey) throw new Error('A chave do editor mudou. A atualização foi recusada.');
    const oldRollback = localStorage.getItem(`${PREVIOUS_KEY}${id}`);
    const oldRuntime = getPluginRuntime(id);
    const oldState = usePluginStore.getState().installed[id];
    try {
      if (previous) localStorage.setItem(`${PREVIOUS_KEY}${id}`, JSON.stringify(previous));
      saveExternalPlugin(pkg);
      registerPluginRuntime(id, { source: pkg.code, triggerLabel: 'Executar' });
      const store = usePluginStore.getState();
      store.install(id);
      store.setEnabled(id, false);
      await store.persist();
    } catch (error) {
      if (previous) saveExternalPlugin(previous); else removeExternalPlugin(id);
      if (oldRollback) localStorage.setItem(`${PREVIOUS_KEY}${id}`, oldRollback);
      else localStorage.removeItem(`${PREVIOUS_KEY}${id}`);
      if (oldRuntime) registerPluginRuntime(id, oldRuntime); else unregisterPluginRuntime(id);
      usePluginStore.setState(state => {
        const installed = { ...state.installed };
        if (oldState) installed[id] = oldState; else delete installed[id];
        return { installed };
      });
      throw error;
    }
    logService.audit(`Marketplace: ${id} ${pkg.manifest.version}, assinatura verificada; aguarda ativação`, 'executado');
  } finally { changing = false; }
}

export async function rollbackMarketplacePlugin(id: string): Promise<void> {
  const raw = localStorage.getItem(`${PREVIOUS_KEY}${id}`);
  if (!raw) throw new Error('Não há uma versão anterior guardada.');
  const pkg = validatePackage(JSON.parse(raw));
  if (pkg.manifest.id !== id) throw new Error('A versão anterior não corresponde a este plugin.');
  await applyMarketplacePackage(pkg);
}
