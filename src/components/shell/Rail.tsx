import { useEffect, useRef } from 'react';

import { RAIL_ITEMS, type RailItem } from '@/config/navigation';
import { useIsCompact } from '@/hooks/use-media-query';
import { cn } from '@/lib/cn';

interface RailProps {
  readonly isVisible: boolean;
  /** Só conta no modo compacto, onde o rail é uma gaveta. */
  readonly isDrawerOpen: boolean;
  readonly activeId: string;
  readonly onSelect: (item: RailItem) => void;
  readonly onCloseDrawer: () => void;
}

/**
 * Navegação principal.
 *
 * No desktop é um rail estreito que expande ao passar o rato. Abaixo dos 820px
 * torna-se uma gaveta com scrim, aberta pelo botão do header — não é o mesmo
 * componente encolhido, é outro comportamento.
 */
export function Rail({
  isVisible,
  isDrawerOpen,
  activeId,
  onSelect,
  onCloseDrawer,
}: RailProps): React.JSX.Element {
  const isCompact = useIsCompact();
  const navRef = useRef<HTMLElement>(null);

  // Com a gaveta aberta, Escape fecha-a e o foco entra na navegação — sem isto
  // um utilizador de teclado ficava preso atrás do scrim.
  useEffect(() => {
    if (!isCompact || !isDrawerOpen) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCloseDrawer();
    };

    document.addEventListener('keydown', onKeyDown);
    navRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isCompact, isDrawerOpen, onCloseDrawer]);

  return (
    <>
      {/* Scrim: só existe no modo compacto e só com a gaveta aberta. */}
      {isCompact && (
        <div
          className={cn(
            // Acima do dock (z-45): com a gaveta aberta nada por baixo é clicável.
            'fixed inset-0 z-[46] bg-black/60 backdrop-blur-soft transition-opacity duration-panel ease-out',
            isDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}

      <nav
        ref={navRef}
        aria-label="Navegação principal"
        aria-hidden={isCompact && !isDrawerOpen}
        className={cn(
          'glass group fixed bottom-0 left-0 top-header z-rail overflow-y-auto overflow-x-hidden px-3 py-s2',
          'border-r border-line transition-[width,transform] duration-panel ease-out',
          isCompact
            ? // Gaveta: largura fixa, entra e sai do lado esquerdo, por cima do dock.
              ['z-[47] w-rail-open', isDrawerOpen ? 'translate-x-0' : '-translate-x-full']
            : // Rail: expande ao passar o rato.
              ['w-rail hover:w-rail-open', isVisible ? 'translate-x-0' : '-translate-x-full'],
        )}
        style={{ paddingBottom: 'calc(var(--s2) + env(safe-area-inset-bottom, 0px))' }}
      >
        {RAIL_ITEMS.map((item, index) =>
          item === null ? (
            // eslint-disable-next-line react/no-array-index-key -- separadores não têm identidade
            <div key={`sep-${index}`} className="mx-1 my-3 h-px bg-line" />
          ) : (
            <RailButton
              key={item.id}
              item={item}
              isActive={item.id === activeId}
              isExpanded={isCompact}
              onSelect={onSelect}
            />
          ),
        )}
      </nav>
    </>
  );
}

interface RailButtonProps {
  readonly item: RailItem;
  readonly isActive: boolean;
  /** Na gaveta a etiqueta está sempre visível; no rail aparece no hover. */
  readonly isExpanded: boolean;
  readonly onSelect: (item: RailItem) => void;
}

function RailButton({
  item,
  isActive,
  isExpanded,
  onSelect,
}: RailButtonProps): React.JSX.Element {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative mb-[3px] flex h-[46px] w-full items-center gap-[14px] rounded-input px-[15px]',
        'text-t2 transition-colors duration-hover ease-out',
        'hover:bg-card-hover hover:text-t1',
        isActive && 'bg-gradient-to-r from-accent/[.12] to-transparent text-accent',
      )}
    >
      {/* Marca do item ativo, colada à borda esquerda do rail. */}
      <span
        className={cn(
          'absolute -left-3 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-accent shadow-glow',
          'transition-[height] duration-[240ms] ease-out',
          isActive ? 'h-[22px]' : 'h-0',
        )}
        aria-hidden="true"
      />

      <Icon
        className={cn(
          'h-[22px] w-[22px] flex-shrink-0 transition-transform duration-hover ease-out',
          isActive ? 'opacity-100' : 'opacity-80',
          'group-hover:scale-[1.06]',
        )}
        aria-hidden="true"
      />

      <span
        className={cn(
          'whitespace-nowrap text-sm font-medium transition-[opacity,transform] duration-panel ease-out',
          isExpanded
            ? 'translate-x-0 opacity-100'
            : '-translate-x-1.5 opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
        )}
      >
        {item.label}
      </span>
    </button>
  );
}
