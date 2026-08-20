/**
 * Progresso do descarregamento automático do modelo Llama por omissão
 * (item, 20/08/2026 — "o JARVIS fica inteligente sem precisar de adicionar
 * mais nada"). Espelha `PullEvent` de `src-tauri/src/ollama.rs`.
 */
export type OllamaPullEvent =
  | { readonly phase: 'started'; readonly model: string }
  | { readonly phase: 'progress'; readonly model: string; readonly percent: number }
  | { readonly phase: 'done'; readonly model: string }
  | { readonly phase: 'failed'; readonly model: string; readonly error: string };
