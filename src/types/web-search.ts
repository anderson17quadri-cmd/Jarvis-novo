/** Pesquisa web (Peça 18). */

/**
 * Um resultado de pesquisa — só título, resumo e endereço. Nunca o HTML da
 * página de resultados nem o conteúdo completo de nenhum site: isto é tudo o
 * que o modelo recebe para decidir o passo seguinte.
 */
export interface SearchResult {
  readonly title: string;
  readonly snippet: string;
  readonly url: string;
}

/** O que uma pesquisa devolve, mais a marca de ter sido simulada ou real. */
export interface SearchOutcome {
  readonly isSimulated: boolean;
  readonly results: readonly SearchResult[];
}
