/** Explorador de ficheiros (Parte 6.1 §Dock — Explorador). */

export type FileKind = 'pasta' | 'documento' | 'imagem' | 'video' | 'audio' | 'codigo' | 'arquivo';

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  pasta: 'Pasta',
  documento: 'Documento',
  imagem: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  codigo: 'Código',
  arquivo: 'Arquivo',
};

export interface FileEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: FileKind;
  /** `null` nas pastas — o tamanho de uma pasta exigiria percorrer o disco. */
  readonly sizeBytes: number | null;
  /** Milissegundos desde a época Unix. */
  readonly modifiedAt: number;
  /** Só as pastas têm filhos. */
  readonly children?: readonly FileEntry[];
}

/** Extensão (sem o ponto, minúsculas) → o tipo que o ícone mostra. */
const EXTENSION_KIND: Record<string, FileKind> = {
  pdf: 'documento', doc: 'documento', docx: 'documento', odt: 'documento', rtf: 'documento',
  txt: 'documento', md: 'documento', xls: 'documento', xlsx: 'documento', csv: 'documento',
  ppt: 'documento', pptx: 'documento',
  png: 'imagem', jpg: 'imagem', jpeg: 'imagem', gif: 'imagem', svg: 'imagem', webp: 'imagem',
  bmp: 'imagem', ico: 'imagem',
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio', m4a: 'audio',
  ts: 'codigo', tsx: 'codigo', js: 'codigo', jsx: 'codigo', rs: 'codigo', py: 'codigo',
  json: 'codigo', html: 'codigo', css: 'codigo', sql: 'codigo', toml: 'codigo', yaml: 'codigo',
  yml: 'codigo', sh: 'codigo', ps1: 'codigo',
  zip: 'arquivo', rar: 'arquivo', '7z': 'arquivo', tar: 'arquivo', gz: 'arquivo',
};

/**
 * Adivinha o tipo de um ficheiro real pelo nome — usado só quando a origem é
 * o disco a sério, que não vem com um `kind` já atribuído como a árvore
 * simulada. Uma extensão desconhecida cai em `documento`: o ícone genérico
 * mais parecido com "não sei o que é isto" do conjunto que já existe.
 */
export function fileKindFromName(name: string, isDirectory: boolean): FileKind {
  if (isDirectory) return 'pasta';

  const dot = name.lastIndexOf('.');
  if (dot <= 0) return 'documento';

  const extension = name.slice(dot + 1).toLowerCase();
  return EXTENSION_KIND[extension] ?? 'documento';
}

/** Procura uma entrada pelo caminho de ids, a partir da raiz. */
export function resolvePath(
  root: readonly FileEntry[],
  path: readonly string[],
): readonly FileEntry[] {
  let level = root;

  for (const id of path) {
    const next = level.find((entry) => entry.id === id);
    // Um caminho inválido devolve o que se conseguiu percorrer, em vez de
    // rebentar: acontece se a árvore mudar entre versões.
    if (!next?.children) return level;
    level = next.children;
  }

  return level;
}

/** Um ficheiro ou pasta encontrado por `searchFiles`, com o caminho até lá. */
export interface FileSearchResult {
  readonly entry: FileEntry;
  /** Ids das pastas antecessoras, a partir da raiz — nunca inclui o próprio `entry`. */
  readonly path: readonly string[];
  /** Nomes das pastas antecessoras, na mesma ordem — para mostrar ("Documentos › Propostas"). */
  readonly pathNames: readonly string[];
}

/**
 * Procura ficheiros e pastas pelo nome, em toda a árvore.
 *
 * `query` normaliza-se do mesmo jeito que a pesquisa do resto da app
 * (`normalizeSearch` — minúsculas, sem acentos), para "orcamento" encontrar
 * "orçamento-hardware-revisto.pdf". `path`/`pathNames` são sempre as pastas
 * **antecessoras**, nunca o próprio resultado — abrir o Explorador nesse
 * caminho deixa o ficheiro encontrado visível na listagem, seja ele um
 * ficheiro ou uma pasta.
 */
export function searchFiles(
  root: readonly FileEntry[],
  query: string,
  normalize: (value: string) => string,
): readonly FileSearchResult[] {
  const normalized = normalize(query);
  if (normalized.length === 0) return [];

  const results: FileSearchResult[] = [];

  function walk(
    entries: readonly FileEntry[],
    path: readonly string[],
    pathNames: readonly string[],
  ): void {
    for (const entry of entries) {
      if (normalize(entry.name).includes(normalized)) {
        results.push({ entry, path, pathNames });
      }
      if (entry.children) {
        walk(entry.children, [...path, entry.id], [...pathNames, entry.name]);
      }
    }
  }

  walk(root, [], []);
  return results;
}
