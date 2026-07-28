import { useCallback, useRef } from 'react';

import { DOCK_ITEMS } from '@/config/navigation';
import { useIsCoarsePointer, useReducedMotion } from '@/hooks/use-media-query';
import { cn } from '@/lib/cn';
import type { AppId } from '@/types/app';

/** Escala máxima do ícone sob o cursor. */
const MAX_SCALE = 1.45;
/** Raio de influência da magnificação, em pixels. */
const INFLUENCE_PX = 150;

interface DockProps {
  readonly isVisible: boolean;
  readonly openAppIds: readonly AppId[];
  readonly onLaunch: (appId: AppId) => void;
}

/**
 * Dock.
 *
 * No desktop os ícones ampliam-se em função da distância ao cursor. Em ecrãs de
 * toque a magnificação não se liga — não há cursor — e o dock ganha scroll
 * horizontal, com os alvos de toque acima dos 44px.
 */
export function Dock({ isVisible, openAppIds, onLaunch }: DockProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const isCoarsePointer = useIsCoarsePointer();
  const reducedMotion = useReducedMotion();
  const magnifies = !isCoarsePointer && !reducedMotion;

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!magnifies) return;

      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-dock-item]');
      if (!buttons) return;

      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        const distance = Math.abs(event.clientX - (rect.left + rect.width / 2));
        const scale = Math.max(1, MAX_SCALE - distance / INFLUENCE_PX);
        // Só `transform`: não força layout nem repaint das vizinhas.
        button.style.transform = `scale(${scale.toFixed(3)}) translateY(${(-(scale - 1) * 13).toFixed(1)}px)`;
      }
    },
    [magnifies],
  );

  const onPointerLeave = useCallback((): void => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-dock-item]');
    if (!buttons) return;
    for (const button of buttons) button.style.transform = '';
  }, []);

  return (
    <div
      ref={listRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn(
        'fixed bottom-[22px] left-1/2 z-dock flex items-end gap-[10px] rounded-card px-[15px] py-[11px]',
        'border border-line-2 bg-glass-deep/[.6] shadow-1 backdrop-blur-glass',
        'transition-transform duration-[550ms] ease-out',
        /*
         * No compacto deixa de ser uma ilha centrada e passa a faixa: ancorada
         * às duas margens, com scroll horizontal. Centrar por `translate` num
         * ecrã estreito deixava metade dos ícones fora do viewport.
         */
        'compact:bottom-[14px] compact:left-s2 compact:right-s2 compact:gap-[7px]',
        'compact:overflow-x-auto compact:px-[11px] compact:py-[9px]',
        isVisible
          ? '-translate-x-1/2 translate-y-0 compact:translate-x-0'
          : 'translate-x-[-50%] translate-y-[140%] compact:translate-x-0',
      )}
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="toolbar"
      aria-label="Aplicações"
    >
      {DOCK_ITEMS.map((item) => {
        const Icon = item.icon;
        const isOpen = openAppIds.includes(item.appId);

        return (
          <button
            key={item.appId}
            type="button"
            data-dock-item
            onClick={() => onLaunch(item.appId)}
            aria-label={item.label}
            className={cn(
              'group/dock relative flex h-[46px] w-[46px] flex-shrink-0 origin-bottom items-center justify-center',
              'rounded-input border border-line bg-tint/[.03] text-t2',
              'transition-[transform,color,background,border-color] duration-[220ms] ease-out',
              'hover:border-accent/30 hover:bg-accent/[.07] hover:text-accent',
              // Nunca abaixo de 44px em ecrãs de toque.
              'compact:h-[44px] compact:w-[44px]',
              '[&>svg]:h-[21px] [&>svg]:w-[21px]',
            )}
          >
            <Icon aria-hidden="true" />

            {/* Ponto de "em execução". */}
            <span
              className={cn(
                'absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent',
                'shadow-[0_0_7px_var(--accent)] transition-opacity duration-200',
                isOpen ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />

            {/* Tooltip só com rato — num ecrã de toque nunca apareceria de forma útil. */}
            {!isCoarsePointer && (
              <span
                className={cn(
                  'pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 translate-y-1',
                  'whitespace-nowrap rounded-[10px] border border-line bg-glass/[.95] px-[10px] py-[5px]',
                  'text-[11.5px] opacity-0 backdrop-blur-[14px] transition-[opacity,transform] duration-[180ms] ease-out',
                  'group-hover/dock:translate-y-0 group-hover/dock:opacity-100',
                )}
                aria-hidden="true"
              >
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
