import { useEffect } from 'react';

export interface ShortcutDefinition {
  /** Tecla em minúsculas, como `k`. */
  readonly key: string;
  /** CTRL no Windows, CMD no Mac — tratados como o mesmo modificador. */
  readonly ctrlOrMeta?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
}

/**
 * Regista um atalho de teclado dentro da janela.
 *
 * Atalhos globais (fora da aplicação) são outra coisa: vivem no Rust e chegam
 * pelo `PlatformAdapter.onGlobalInvoke`.
 */
export function useKeyboardShortcut(
  shortcut: ShortcutDefinition,
  handler: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== shortcut.key) return;
      if ((shortcut.ctrlOrMeta ?? false) !== (event.ctrlKey || event.metaKey)) return;
      if ((shortcut.shift ?? false) !== event.shiftKey) return;
      if ((shortcut.alt ?? false) !== event.altKey) return;

      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handler, shortcut.alt, shortcut.ctrlOrMeta, shortcut.key, shortcut.shift]);
}
