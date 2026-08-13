/**
 * Vault Obsidian real (Peça 17) — memória persistente a sério, para além do
 * que `memory-service.ts` guarda (preferências ditas por palavras). O
 * assistente procura, lê e escreve notas `.md` numa pasta escolhida pela
 * pessoa — nunca inventa uma nota, nunca ingere o vault inteiro de uma vez.
 */

/** Uma nota real, devolvida por `obsidian_list_notes`. */
export interface ObsidianNote {
  /** Caminho relativo à raiz do vault (com `/`, mesmo no Windows). */
  readonly path: string;
  /** Nome do ficheiro sem a extensão `.md`. */
  readonly title: string;
  /** Milissegundos desde a época Unix. */
  readonly modifiedAt: number;
}

/** A raiz do vault, depois de declarada. */
export interface RealObsidianRoot {
  readonly path: string;
  readonly name: string;
}
