import { STORAGE_KEYS, type StorageKey } from '@/services/storage-service';

/**
 * Cópia de segurança do sistema (Parte 14 §Backups e restauro).
 *
 * Tudo o que o JARVIS sabe de si vive no armazenamento local: temas, layouts,
 * conversas, memória, tarefas, automações, plugins. Sem uma forma de o tirar
 * de lá, limpar os dados do browser é perder o sistema inteiro — e nem sequer
 * é preciso querer, basta uma limpeza de rotina.
 *
 * O ficheiro é JSON legível de propósito. Uma cópia de segurança que só o
 * próprio programa consegue ler é uma cópia que se perde com o programa.
 */

/** Marca do formato. Serve para recusar um JSON qualquer antes de o aplicar. */
export const BACKUP_FORMAT = 'jarvis-backup';

/**
 * Versão do formato.
 *
 * Sobe quando a forma do ficheiro mudar de maneira que uma versão anterior não
 * consiga ler. Não sobe quando se acrescenta uma chave nova — as que faltam
 * ficam por repor, e isso está previsto.
 */
export const BACKUP_VERSION = 1;

/**
 * O que **nunca** entra numa cópia de segurança.
 *
 * A chave da API é um segredo. Já hoje vive num sítio que não é seguro, e a
 * janela di-lo por escrito; pô-la também num ficheiro que se descarrega, se
 * envia por email e se guarda numa drive era transformar um problema conhecido
 * num problema espalhado.
 *
 * O resto das definições de IA vai — provedor e modelo não são segredo. Quem
 * repõe volta a colar a chave, e a interface diz-lho.
 */
export const SECRET_FIELDS: Readonly<Partial<Record<StorageKey, readonly string[]>>> = {
  [STORAGE_KEYS.aiSettings]: ['apiKey'],
};

export interface JarvisBackup {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly createdAt: number;
  /**
   * Só as chaves que tinham alguma coisa guardada.
   *
   * Gravar as vazias fazia um ficheiro cheio de `null` que, ao ser reposto,
   * apagava o que estivesse no sítio — repor uma cópia antiga não pode ser
   * pior do que não repor nada.
   */
  readonly data: Readonly<Partial<Record<StorageKey, unknown>>>;
}

/** Porque é que um ficheiro não serve. A interface mostra isto tal e qual. */
export type BackupProblem =
  | 'nao-e-json'
  | 'nao-e-uma-copia'
  | 'versao-mais-recente'
  | 'sem-dados';

export const BACKUP_PROBLEMS: Record<BackupProblem, string> = {
  'nao-e-json': 'Este ficheiro não é JSON. Escolha o ficheiro que descarregou daqui.',
  'nao-e-uma-copia': 'Este JSON não é uma cópia de segurança do JARVIS.',
  'versao-mais-recente':
    'Esta cópia foi feita por uma versão mais recente do JARVIS. Atualize antes de a repor.',
  'sem-dados': 'A cópia não tem nada lá dentro.',
};

export type BackupRead =
  | { readonly ok: true; readonly backup: JarvisBackup }
  | { readonly ok: false; readonly problem: BackupProblem };

/** As chaves conhecidas, para descartar o que uma versão futura tenha inventado. */
const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(STORAGE_KEYS));

/**
 * Lê e valida um ficheiro.
 *
 * Devolve o problema em vez de lançar: quem chama é interface, e uma exceção
 * obrigava a apanhá-la só para escrever a mesma frase.
 */
export function readBackup(text: string): BackupRead {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'nao-e-json' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, problem: 'nao-e-uma-copia' };
  }

  const candidate = parsed as Partial<JarvisBackup>;

  if (candidate.format !== BACKUP_FORMAT) {
    return { ok: false, problem: 'nao-e-uma-copia' };
  }

  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    return { ok: false, problem: 'versao-mais-recente' };
  }

  if (typeof candidate.data !== 'object' || candidate.data === null) {
    return { ok: false, problem: 'sem-dados' };
  }

  // Uma chave que esta versão não conhece é descartada em silêncio: escrevê-la
  // no armazenamento enchia-o de lixo que ninguém volta a ler.
  const data: Partial<Record<StorageKey, unknown>> = {};
  for (const [key, value] of Object.entries(candidate.data)) {
    if (KNOWN_KEYS.has(key)) data[key as StorageKey] = value;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, problem: 'sem-dados' };
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: candidate.version,
      createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : 0,
      data,
    },
  };
}

/** Tira os segredos de um valor antes de ele ir para o ficheiro. */
export function withoutSecrets(key: StorageKey, value: unknown): unknown {
  const fields = SECRET_FIELDS[key];
  if (!fields || typeof value !== 'object' || value === null) return value;

  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  // Apagar em vez de pôr a vazio: quem repõe vê a chave em falta e sabe que
  // tem de a colar, em vez de ficar com uma string vazia que parece definida.
  for (const field of fields) delete copy[field];

  return copy;
}

/** Nome do ficheiro, com a data de quem o faz. */
export function backupFilename(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `jarvis-${stamp}.json`;
}
