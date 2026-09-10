/**
 * Identificadores únicos para notificações e janelas.
 *
 * Usa `crypto.randomUUID` quando existe; o contador é a alternativa para
 * contextos sem crypto (WebViews antigos, jsdom em alguns ambientes).
 */
let counter = 0;

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
