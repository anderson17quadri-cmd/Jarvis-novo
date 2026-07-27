import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  LayoutGrid,
  Palette,
  Plus,
  RotateCcw,
  Settings,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { useIsCoarsePointer } from '@/hooks/use-media-query';
import { cn } from '@/lib/cn';
import { notificationService } from '@/services/notification-service';
import type { AppId } from '@/types/app';

interface ContextAction {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly run: (handlers: ContextMenuHandlers) => void;
}

export interface ContextMenuHandlers {
  readonly launchApp: (appId: AppId) => void;
  readonly openPalette: () => void;
}

/** `null` desenha um separador. */
const ACTIONS: readonly (ContextAction | null)[] = [
  {
    id: 'new-widget',
    label: 'Novo widget',
    icon: Plus,
    run: () => notificationService.info('Widgets', 'O criador de widgets abre no Plugin Manager.'),
  },
  {
    id: 'new-note',
    label: 'Nova nota',
    icon: StickyNote,
    run: () => notificationService.success('Nota criada', 'Guardada em Notas · sem título.'),
  },
  {
    id: 'new-project',
    label: 'Novo projeto',
    icon: LayoutGrid,
    run: (handlers) => handlers.launchApp('projects'),
  },
  null,
  {
    id: 'theme',
    label: 'Alterar tema',
    icon: Palette,
    run: (handlers) => handlers.launchApp('themes'),
  },
  {
    id: 'refresh',
    label: 'Atualizar',
    icon: RotateCcw,
    run: () =>
      notificationService.success('Ambiente atualizado', 'Widgets e serviços recarregados.'),
  },
  null,
  {
    id: 'settings',
    label: 'Configurações',
    icon: Settings,
    run: (handlers) => handlers.launchApp('themes'),
  },
  {
    id: 'help',
    label: 'Ajuda',
    icon: HelpCircle,
    run: (handlers) => handlers.openPalette(),
  },
];

/** Margem mínima entre o menu e a borda do ecrã. */
const EDGE_MARGIN_PX = 12;

interface DesktopContextMenuProps {
  readonly handlers: ContextMenuHandlers;
  readonly isEnabled: boolean;
}

/**
 * Menu contextual do ambiente de trabalho.
 *
 * Não se liga em ecrãs de toque: aí o clique longo já pertence ao sistema, e
 * roubá-lo estraga a seleção de texto e os gestos do Android.
 */
export function DesktopContextMenu({
  handlers,
  isEnabled,
}: DesktopContextMenuProps): React.JSX.Element | null {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isCoarsePointer = useIsCoarsePointer();
  const isActive = isEnabled && !isCoarsePointer;

  const close = useCallback(() => setPosition(null), []);

  useEffect(() => {
    if (!isActive) return;

    const onContextMenu = (event: MouseEvent): void => {
      // Dentro de campos de texto o menu nativo é mais útil (colar, corrigir).
      if (event.target instanceof Element && event.target.closest('input, textarea')) return;

      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, isActive]);

  // Corrigir a posição depois de medir, antes de o browser pintar: assim o menu
  // nunca chega a aparecer meio fora do ecrã.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !position) return;

    const rect = menu.getBoundingClientRect();
    const x = Math.min(position.x, window.innerWidth - rect.width - EDGE_MARGIN_PX);
    const y = Math.min(position.y, window.innerHeight - rect.height - EDGE_MARGIN_PX);

    if (x !== position.x || y !== position.y) {
      setPosition({ x: Math.max(EDGE_MARGIN_PX, x), y: Math.max(EDGE_MARGIN_PX, y) });
    }
  }, [position]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Menu do ambiente de trabalho"
      style={{ left: position.x, top: position.y }}
      className={cn(
        'fixed z-context min-w-[212px] rounded-input border border-line-2 p-[7px]',
        'bg-[rgb(16_25_34_/_0.94)] shadow-2 backdrop-blur-panel motion-safe:animate-window-in',
      )}
    >
      {ACTIONS.map((action, index) =>
        action === null ? (
          // Separadores não têm identidade própria; o índice serve de chave.
          <div key={`sep-${index}`} className="mx-1 my-1.5 h-px bg-line" />
        ) : (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              action.run(handlers);
            }}
            className={cn(
              'flex w-full items-center gap-[11px] rounded-[10px] px-[11px] py-[9px]',
              'text-[13.5px] text-t2 transition-colors duration-hover',
              'hover:bg-accent/10 hover:text-accent',
            )}
          >
            <action.icon className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden="true" />
            {action.label}
          </button>
        ),
      )}
    </div>
  );
}
