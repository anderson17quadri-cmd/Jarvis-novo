import type { PlatformKind } from '@/types/platform';

/**
 * Deteta em que plataforma a aplicação está a correr.
 *
 * A deteção acontece uma vez, aqui. Nenhum outro sítio do código repete esta
 * lógica — quem precisa de saber algo pergunta às `capabilities` do adapter.
 */

/** O Tauri injeta `__TAURI_INTERNALS__` no `window` antes do bundle correr. */
function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * O WebView do Android identifica-se no user agent. Não é infalível, mas dentro
 * do Tauri as únicas hipóteses são desktop e Android, o que torna o teste seguro.
 */
function isAndroidUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function detectPlatform(): PlatformKind {
  if (!isTauriRuntime()) return 'web';
  return isAndroidUserAgent() ? 'android' : 'desktop';
}

/** Ecrã de toque — desativa cursor personalizado, tooltips do dock e arrastar. */
export function detectTouch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
