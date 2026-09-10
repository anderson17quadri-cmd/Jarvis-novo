import type { PluginPackage } from './plugin';

/**
 * Armazenamento de plugins instalados de ficheiro.
 *
 * Cada plugin externo é guardado em localStorage com a chave
 * `jarvis.plugin-package:<id>` — o manifesto e o código sobrevivem
 * a fechar e reabrir a aplicação.
 *
 * Separado do `plugin-service.ts` de propósito: o serviço de plugins
 * lida com o catálogo e a lista de instalados; isto lida com os dados
 * completos dos que vieram de fora do catálogo.
 */

const KEY_PREFIX = 'jarvis.plugin-package:';

/** Guarda um pacote de plugin externo. Sobrescreve se já existir. */
export function saveExternalPlugin(pkg: PluginPackage): void {
  localStorage.setItem(keyFor(pkg.manifest.id), JSON.stringify(pkg));
}

/** Lê um pacote de plugin externo. Devolve `undefined` se não existir. */
export function loadExternalPlugin(id: string): PluginPackage | undefined {
  try {
    const raw = localStorage.getItem(keyFor(id));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PluginPackage;
    if (!isValidPackage(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Remove um pacote de plugin externo. Idempotente. */
export function removeExternalPlugin(id: string): void {
  localStorage.removeItem(keyFor(id));
}

/** Todos os ids de plugins externos guardados. */
export function listExternalPluginIds(): readonly string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave?.startsWith(KEY_PREFIX)) {
      ids.push(chave.slice(KEY_PREFIX.length));
    }
  }
  return ids;
}

/** Todos os pacotes de plugins externos guardados. */
export function loadAllExternalPlugins(): readonly PluginPackage[] {
  return listExternalPluginIds()
    .map((id) => loadExternalPlugin(id))
    .filter((pkg): pkg is PluginPackage => pkg !== undefined);
}

/** Esvazia o armazenamento de plugins externos — para testes. */
export function clearExternalPlugins(): void {
  for (const id of listExternalPluginIds()) {
    localStorage.removeItem(keyFor(id));
  }
}

function keyFor(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

/** Validação mínima da forma de um `PluginPackage`. */
function isValidPackage(data: unknown): data is PluginPackage {
  if (typeof data !== 'object' || data === null) return false;
  const pkg = data as Record<string, unknown>;
  return (
    typeof pkg.manifest === 'object' &&
    pkg.manifest !== null &&
    typeof (pkg.manifest as Record<string, unknown>).id === 'string' &&
    typeof pkg.signature === 'string' &&
    typeof pkg.signerPublicKey === 'string' &&
    typeof pkg.code === 'string'
  );
}
