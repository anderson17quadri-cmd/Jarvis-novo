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
