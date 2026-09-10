/**
 * Escolha do vault Obsidian (Peça 17).
 *
 * Mesmo desenho da música (`music-settings.ts`): só o caminho de uma pasta,
 * sem segredo nenhum — vai para o storage normal, não para o cofre. Sem
 * pasta escolhida, o vault simplesmente não está configurado; não há
 * simulação nenhuma para um "vault de exemplo", ao contrário da música e da
 * meteorologia — um vault inventado não teria nada de útil para mostrar.
 */

export interface ObsidianSettings {
  /** Caminho absoluto da pasta do vault. Vazio = não configurado. */
  readonly rootPath: string;
  /** Nome da pasta, para mostrar na interface sem o caminho inteiro. */
  readonly rootName: string;
}

export const DEFAULT_OBSIDIAN_SETTINGS: ObsidianSettings = {
  rootPath: '',
  rootName: '',
};
