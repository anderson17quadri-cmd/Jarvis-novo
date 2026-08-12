import { create } from 'zustand';

/**
 * Onde o Explorador de Ficheiros deve abrir da próxima vez que montar.
 *
 * `FilesWindow.tsx` é uma janela genérica, montada pelo `WindowManager` sem
 * nenhuma prop — não há como lhe passar "abre nesta pasta" diretamente. Este
 * store é o canal: `abrir_ficheiro` (`tool-runner.ts`) escreve o caminho
 * antes de abrir a janela, `FilesWindow` lê-o (e limpa-o) no primeiro
 * render, para uma segunda abertura normal do Explorador não herdar um
 * caminho de uma pesquisa antiga.
 */
interface PendingFileNavigationState {
  readonly path: readonly string[] | null;
  readonly set: (path: readonly string[]) => void;
  /** Lê o caminho pendente e limpa-o — só serve para a primeira leitura. */
  readonly consume: () => readonly string[] | null;
}

export const usePendingFileNavigationStore = create<PendingFileNavigationState>((set, get) => ({
  path: null,

  set: (path) => set({ path }),

  consume: () => {
    const path = get().path;
    if (path !== null) set({ path: null });
    return path;
  },
}));
