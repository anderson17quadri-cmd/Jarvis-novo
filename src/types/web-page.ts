/**
 * Navegador controlado pelo assistente (Peça 19, lote 5) — o que
 * `fetch_page_text` devolve depois de ler e limpar uma página.
 */
export interface WebPageContent {
  readonly title: string;
  /** Texto visível, sem script/style/noscript — nunca HTML. */
  readonly text: string;
  /** `true` se o texto foi cortado por ser demasiado longo. */
  readonly truncated: boolean;
}
