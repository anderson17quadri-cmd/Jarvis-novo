/**
 * Política de URLs externos.
 *
 * O `shell` do Tauri nunca é aberto a comandos vindos da interface. A única
 * coisa que a interface pode pedir é "abre este endereço na aplicação
 * predefinida", e mesmo isso só para os esquemas desta lista.
 *
 * Duplicado de propósito com a capability em `src-tauri/capabilities/default.json`:
 * a interface filtra cedo para dar erro claro, o Rust filtra por segurança.
 */
const ALLOWED_PROTOCOLS = new Set(['https:', 'mailto:']);

export function isAllowedExternalUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    // URL malformado — recusar.
    return false;
  }
}
