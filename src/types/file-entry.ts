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
