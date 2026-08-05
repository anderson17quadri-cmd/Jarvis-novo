import { hydrateAll } from '@/services/hydrate-all';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS, type StorageKey } from '@/services/storage-service';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  withoutSecrets,
  type JarvisBackup,
} from '@/types/backup';

/**
 * Cópias de segurança (Parte 14 §Backups e restauro).
 *
 * Lê e escreve pelo `storageService`, e por isso funciona igual no browser, no
 * desktop e no Android — quem sabe onde as coisas ficam é o adapter.
 *
 * O que **não** faz é falar com o disco. Descarregar e escolher um ficheiro são
 * decisões da interface, e no browser fazem-se com um `Blob` e um `<input
 * type="file">`. Um diálogo nativo a sério exige o plugin `dialog`, que está
 * bloqueado até haver PC — e o resultado seria o mesmo ficheiro.
 */

/** Todas as chaves, por ordem alfabética, para o ficheiro sair sempre igual. */
const ALL_KEYS: readonly StorageKey[] = [...Object.values(STORAGE_KEYS)].sort();

export async function createBackup(now: number = Date.now()): Promise<JarvisBackup> {
  const data: Partial<Record<StorageKey, unknown>> = {};

  for (const key of ALL_KEYS) {
    // `null` é o que o armazenamento devolve quando a chave nunca foi escrita.
    // Guardar essas fazia um ficheiro que, ao ser reposto, apagava o que
    // estivesse no sítio.
    const value = await storageService.get<unknown>(key, null);
    if (value === null) continue;

    data[key] = withoutSecrets(key, value);
  }

  logService.audit('Criar uma cópia de segurança', 'executado');

  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now, data };
}

/** O ficheiro, já formatado. Indentado porque é para se poder abrir e ler. */
export function serializeBackup(backup: JarvisBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/**
 * Repõe uma cópia e volta a ler tudo para as stores.
 *
 * Só escreve as chaves que a cópia traz. Uma cópia feita antes de existirem
 * layouts guardados não pode apagar os layouts de quem a repõe hoje — repor
 * uma cópia antiga tem de ser um passo atrás, não um recomeço.
 */
export async function restoreBackup(backup: JarvisBackup): Promise<number> {
  const entries = Object.entries(backup.data) as readonly [StorageKey, unknown][];

  for (const [key, value] of entries) {
    await storageService.set(key, value);
  }

  await hydrateAll();

  logService.audit(`Repor uma cópia de segurança (${entries.length} secções)`, 'executado');
  return entries.length;
}
