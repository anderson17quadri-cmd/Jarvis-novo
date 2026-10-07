import { create } from 'zustand';
import type { RealFilesRoot } from '@/types/real-file-entry';

/**
 * Onde o Explorador deve navegar, mesmo que a janela já esteja aberta.
 *
 * `FilesWindow.tsx` é uma janela genérica, montada pelo `WindowManager` sem
 * nenhuma prop — não há como lhe passar "abre nesta pasta" diretamente. Este
 * store é o canal: `abrir_ficheiro` (`tool-runner.ts`) escreve o caminho
 * antes de abrir a janela; `FilesWindow` consome cada pedido uma única vez.
 */
interface PendingFileNavigationState {
  readonly path: readonly string[] | null;
  readonly realParents: readonly RealFilesRoot[] | null;
  readonly setReal: (parents: readonly RealFilesRoot[]) => void;
  readonly consumeReal: () => readonly RealFilesRoot[] | null;
  readonly set: (path: readonly string[]) => void;
  /** Lê o caminho pendente e limpa-o — só serve para a primeira leitura. */
  readonly consume: () => readonly string[] | null;
}

export const usePendingFileNavigationStore = create<PendingFileNavigationState>((set, get) => ({
  path: null,
  realParents: null,

  set: (path) => set({ path, realParents: null }),
  setReal: (realParents) => set({ realParents, path: null }),
  consumeReal: () => {
    const parents = get().realParents;
    if (parents !== null) set({ realParents: null });
    return parents;
  },

  consume: () => {
    const path = get().path;
    if (path !== null) set({ path: null });
    return path;
  },
}));
