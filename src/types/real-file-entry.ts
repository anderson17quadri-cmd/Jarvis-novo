/** Sistema de ficheiros real (Parte 6.1 §Dock — Explorador, ligação ao disco). */

/**
 * Uma entrada real do disco, devolvida pelo comando Rust `files_read_dir`.
 *
 * Ao contrário de `FileEntry` (a árvore simulada), não tem `children` — uma
 * pasta real lê-se um nível de cada vez, nunca inteira de uma vez, e o
 * caminho é o próprio caminho do sistema operativo, não uma cadeia de ids.
 */
export interface RealFileEntry {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
  /** `null` nas pastas — o mesmo motivo de `FileEntry.sizeBytes`. */
  readonly sizeBytes: number | null;
  /** Milissegundos desde a época Unix. */
  readonly modifiedAt: number;
}

/** A pasta-raiz declarada — a única fronteira que `files_read_dir` respeita. */
export interface RealFilesRoot {
  readonly path: string;
  readonly name: string;
}
