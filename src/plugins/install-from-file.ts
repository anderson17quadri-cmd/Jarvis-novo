import { open as openDialog } from '@tauri-apps/plugin-dialog';

import type { PluginManifest, PluginPackage } from './plugin';
import { getPluginRuntime, registerPluginRuntime } from './runtime/registry';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { verifyAndInstallPlugin } from '@/stores/use-plugin-store';
import { saveExternalPlugin } from './external-storage';

/**
 * Resultado de tentar instalar um plugin de ficheiro.
 *
 * `ok: true` significa instalado e a correr. `ok: false` traz o motivo em
 * português claro, para mostrar diretamente à pessoa.
 */
export interface InstallFromFileResult {
  readonly ok: boolean;
  /** Motivo legível da recusa. Só definido quando `ok` é `false`. */
  readonly error?: string;
  /** Nome do plugin instalado. Só definido quando `ok` é `true`. */
  readonly pluginName?: string;
}

/**
 * Abre o diálogo nativo de ficheiro, lê um `.jarvis-plugin` e instala-o.
 *
 * Fluxo completo:
 * 1. Diálogo nativo (`openDialog`) com filtro `.jarvis-plugin`
 * 2. Comando Rust `read_plugin_file` para ler o conteúdo
 * 3. `JSON.parse` e validação da forma do pacote
 * 4. Validação dos campos obrigatórios do manifesto
 * 5. Verificação de assinatura (`verifyAndInstallPlugin` com `isExternal: true`)
 * 6. Se aprovado: guarda o pacote, regista o runtime, mostra notificação
 *
 * Cada recusa tem uma mensagem específica — a pessoa percebe exatamente
 * porque é que o ficheiro não foi aceite.
 */
export async function selectAndInstallPluginFile(): Promise<InstallFromFileResult> {
  // ── 1. Diálogo nativo ──────────────────────────────────────────────────

  let filePath: string | null;
  try {
    const selected = await openDialog({
      multiple: false,
      filters: [
        {
          name: 'Plugin JARVIS',
          extensions: ['jarvis-plugin'],
        },
      ],
    });
    filePath = typeof selected === 'string' ? selected : null;
  } catch (err) {
    return { ok: false, error: `O diálogo de ficheiro falhou: ${String(err)}.` };
  }

  if (!filePath) {
    // A pessoa cancelou — não é erro, é silêncio.
    return { ok: false };
  }

  // ── 2. Ler o ficheiro via comando Rust ─────────────────────────────────

  let rawContent: string;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    rawContent = await invoke<string>('read_plugin_file', { path: filePath });
  } catch (err) {
    return {
      ok: false,
      error: `Não consegui ler o ficheiro: ${String(err)}.`,
    };
  }

  // ── 3. JSON.parse e validação da forma ─────────────────────────────────

  let pkg: PluginPackage;
  try {
    const parsed = JSON.parse(rawContent) as unknown;
    pkg = validatePackage(parsed);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // ── 4. Validar campos obrigatórios do manifesto ────────────────────────

  const manifestError = validateManifest(pkg.manifest);
  if (manifestError) {
    return { ok: false, error: manifestError };
  }

  // ── 5. Verificar assinatura e instalar ─────────────────────────────────

  const result = await verifyAndInstallPlugin({
    id: pkg.manifest.id,
    signature: pkg.signature,
    signerPublicKey: pkg.signerPublicKey,
    isExternal: true,
    manifest: pkg.manifest,
  });

  if (!result.ok) {
    const sigError = describeSignatureRejection(result.status, pkg.manifest.id);
    return { ok: false, error: sigError };
  }

  // ── 6. Guardar pacote e registar runtime ───────────────────────────────

  saveExternalPlugin(pkg);

  // Só registamos o runtime se o plugin tiver código para correr e ainda
  // não estiver registado (ex.: um plugin reinstalado).
  if (pkg.code && !getPluginRuntime(pkg.manifest.id)) {
    registerPluginRuntime(pkg.manifest.id, {
      source: pkg.code,
      triggerLabel: 'Executar',
    });
  }

  const signerInfo = pkg.signerName ? ` por ${pkg.signerName}` : '';

  logService.audit(
    `Plugin externo ${pkg.manifest.id} instalado de ficheiro${signerInfo}`,
    'executado',
  );

  notificationService.success(
    `${pkg.manifest.name} instalado`,
    `Assinatura verificada${signerInfo}. Pronto a usar.`,
    { category: 'plugins' },
  );

  return { ok: true, pluginName: pkg.manifest.name };
}

// ─── Validação ──────────────────────────────────────────────────────────────

/** Valida a forma do pacote. Lança com mensagem em português se inválido. */
export function validatePackage(data: unknown): PluginPackage {
  if (typeof data !== 'object' || data === null) {
    throw new Error('O ficheiro não é um JSON válido — esperava um objeto no nível de topo.');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.manifest !== 'object' || obj.manifest === null) {
    throw new Error('O pacote não tem o campo "manifest".');
  }

  if (typeof obj.signature !== 'string' || obj.signature.length === 0) {
    throw new Error('O pacote não tem o campo "signature" (assinatura Ed25519 em base64).');
  }

  if (typeof obj.signerPublicKey !== 'string' || obj.signerPublicKey.length === 0) {
    throw new Error('O pacote não tem o campo "signerPublicKey" (chave pública Ed25519 em base64).');
  }

  if (typeof obj.code !== 'string') {
    throw new Error('O pacote não tem o campo "code" (código JavaScript do plugin).');
  }

  // `signerName` é opcional — se vier mas não for string, ignoramos.

  const signerName = typeof obj.signerName === 'string' ? obj.signerName : undefined;

  return {
    manifest: obj.manifest as PluginManifest,
    signature: obj.signature,
    signerPublicKey: obj.signerPublicKey,
    ...(signerName ? { signerName } : {}),
    code: obj.code,
  };
}

/** Valida os campos obrigatórios do manifesto. Devolve `undefined` se OK. */
export function validateManifest(manifest: PluginManifest): string | undefined {
  if (typeof manifest.id !== 'string' || manifest.id.length === 0) {
    return 'O manifesto não tem um identificador (id) válido.';
  }

  if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    return 'O manifesto não tem um nome (name) válido.';
  }

  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    return 'O manifesto não tem uma versão (version) válida.';
  }

  if (typeof manifest.author !== 'string' || manifest.author.length === 0) {
    return 'O manifesto não tem um autor (author) válido.';
  }

  if (typeof manifest.permissions !== 'object' || manifest.permissions === null) {
    return 'O manifesto não tem permissões (permissions) declaradas.';
  }

  // Cada permissão tem de ser mesmo `true`/`false` — um valor verdade de outra
  // casta (a string `"false"`, por exemplo) é tratado como concedido a jusante,
  // por isso recusa-se aqui, à instalação, em vez de se deixar correr.
  for (const [permissao, valor] of Object.entries(manifest.permissions)) {
    if (typeof valor !== 'boolean') {
      return `A permissão "${permissao}" tem de ser true ou false.`;
    }
  }

  return undefined;
}

/** Traduz o estado de assinatura para uma mensagem legível. */
function describeSignatureRejection(
  status: string,
  pluginId: string,
): string {
  switch (status) {
    case 'sem-assinatura':
      return 'Este plugin não tem assinatura — plugins de ficheiro precisam de assinatura válida.';
    case 'assinatura-invalida':
      return 'A assinatura deste plugin não é válida — o ficheiro pode ter sido alterado.';
    case 'chave-revogada':
      return 'A chave que assinou este plugin foi revogada.';
    case 'assinado-valido':
      return `O plugin "${pluginId}" já está instalado.`;
    default:
      return `Instalação recusada: ${status}.`;
  }
}
