/**
 * Escolha da pasta de música local (Peça 8, lote 2).
 *
 * Ao contrário do correio e das notícias, aqui **não há segredo nenhum**: só o
 * caminho de uma pasta no disco. Vai para o storage normal, não para o cofre —
 * guardar uma localização como se fosse um segredo seria teatro. A decisão de
 * privacidade é a que conta: por omissão a música continua simulada, e só passa
 * a real quando a pessoa escolhe uma pasta.
 */

export interface MusicSettings {
  /** Caminho absoluto da pasta de música. Vazio = não configurado (simulado). */
  readonly rootPath: string;
  /** Nome da pasta, para mostrar na interface sem o caminho inteiro. */
  readonly rootName: string;
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  rootPath: '',
  rootName: '',
};
