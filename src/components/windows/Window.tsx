import { Suspense, useCallback, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

import { CoreLoader } from '@/components/ui/CoreLoader';
import { useIsCompact } from '@/hooks/use-media-query';
import { useWindowDrag, useWindowResize } from '@/hooks/use-window-drag';
import { cn } from '@/lib/cn';
import { soundService } from '@/services/sound-service';
import { useWindowStore } from '@/stores/use-window-store';
import type { AppDefinition } from '@/types/app';
import type { SnapEdge, WindowInstance, WindowRect } from '@/types/window';
import { maximizedRect, readViewport, rectForSnapEdge } from './snap';

interface WindowProps {
  readonly instance: WindowInstance;
  readonly definition: AppDefinition;
}

/**
 * Uma janela.
 *
 * No desktop arrasta-se, redimensiona-se e encaixa nas bordas. No compacto nada
 * disso se liga: a janela ocupa a largura toda e empilha-se, porque arrastar
 * janelas num telemóvel não é uma experiência encolhida, é uma má experiência.
 */
/** Duração da viagem até ao dock, ao minimizar (Parte 9 §Janelas). */
const MINIMIZE_ANIMATION_MS = 220;

export function Window({ instance, definition }: WindowProps): React.JSX.Element {
  const isCompact = useIsCompact();
  const [snapPreview, setSnapPreview] = useState<SnapEdge>('none');
  const [isMinimizing, setMinimizing] = useState(false);

  const close = useWindowStore((state) => state.close);
  const focus = useWindowStore((state) => state.focus);
  const minimize = useWindowStore((state) => state.minimize);
  const move = useWindowStore((state) => state.move);
  const resize = useWindowStore((state) => state.resize);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const persistLayout = useWindowStore((state) => state.persistLayout);

  const canManipulate = !isCompact && !instance.isMaximized;

  const handleMove = useCallback(
    (position: { x: number; y: number }) => move(instance.id, position),
    [instance.id, move],
  );

  const handleDrop = useCallback(
    (snapRect: WindowRect | null) => {
      if (snapRect) {
        move(instance.id, { x: snapRect.x, y: snapRect.y });
        resize(instance.id, { width: snapRect.width, height: snapRect.height });
      }
      void persistLayout();
    },
    [instance.id, move, persistLayout, resize],
  );

  /**
   * Minimizar não desaparece: a janela encolhe e "viaja" até ao dock, para o
   * utilizador ver para onde foi. Só depois sai do ecrã.
   */
  const handleMinimize = useCallback((): void => {
    setMinimizing(true);
    setTimeout(() => {
      minimize(instance.id);
      setMinimizing(false);
    }, MINIMIZE_ANIMATION_MS);
  }, [instance.id, minimize]);

  const drag = useWindowDrag(instance.rect, {
    onMove: handleMove,
    onDrop: handleDrop,
    onSnapPreview: setSnapPreview,
    enabled: canManipulate,
  });

  const resizeHandlers = useWindowResize(instance.rect, {
    onResize: useCallback(
      (size: { width: number; height: number }) => resize(instance.id, size),
      [instance.id, resize],
    ),
    onEnd: useCallback(() => void persistLayout(), [persistLayout]),
    enabled: canManipulate,
  });

  const Content = definition.component;

  if (instance.isMinimized) return <></>;

  return (
    <>
      {snapPreview !== 'none' && <SnapPreview edge={snapPreview} />}

      <section
        aria-label={instance.title}
        onPointerDown={() => focus(instance.id)}
        style={
          isCompact
            ? { zIndex: instance.zIndex }
            : {
                zIndex: instance.zIndex,
                left: `${instance.rect.x}px`,
                top: `${instance.rect.y}px`,
                width: `${instance.rect.width}px`,
                height: `${instance.rect.height}px`,
              }
        }
        className={cn(
          'fixed flex flex-col overflow-hidden rounded-card border border-line-2',
          'bg-glass/[.72] backdrop-blur-[34px]',
          '[box-shadow:var(--sh-2),inset_0_1px_0_rgb(255_255_255_/_0.06)]',
          'motion-safe:animate-window-in',
          // No compacto: largura toda, altura limitada, sem posicionamento livre.
          isCompact && 'inset-x-s2 top-[calc(var(--header-h)+12px)] max-h-[56vh]',
          // A viagem até ao dock: encolhe em direção ao fundo do ecrã.
          isMinimizing && 'window-minimizing',
        )}
      >
        <header
          {...drag}
          className={cn(
            'flex h-11 flex-shrink-0 select-none items-center gap-2.5 border-b border-line px-3.5',
            canManipulate ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
          )}
        >
          <definition.icon className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1 truncate text-[13px] font-medium">{instance.title}</span>

          <div className="flex gap-[5px]">
            <ControlButton label="Minimizar" onClick={handleMinimize}>
              <Minus />
            </ControlButton>

            {/* Maximizar não existe no compacto: a janela já ocupa a largura toda. */}
            {!isCompact && (
              <ControlButton
                label={instance.isMaximized ? 'Restaurar' : 'Maximizar'}
                onClick={() => {
                  toggleMaximize(instance.id, maximizedRect(readViewport()));
                  void persistLayout();
                }}
              >
                <Square />
              </ControlButton>
            )}

            <ControlButton
              label="Fechar"
              onClick={() => {
                soundService.play('close');
                close(instance.id);
              }}
              isDanger
            >
              <X />
            </ControlButton>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-s3">
          <Suspense fallback={<WindowLoading />}>
            <Content />
          </Suspense>
        </div>

        {canManipulate && (
          <div
            {...resizeHandlers}
            role="separator"
            aria-label="Redimensionar janela"
            className="absolute bottom-0 right-0 h-[18px] w-[18px] cursor-nwse-resize touch-none"
          >
            <span className="absolute bottom-[5px] right-[5px] h-[7px] w-[7px] border-b-[1.5px] border-r-[1.5px] border-t3 opacity-60" />
          </div>
        )}
      </section>
    </>
  );
}

/**
 * Sombra que mostra onde a janela vai ficar ao largar.
 *
 * Usa a mesma função que faz o encaixe de verdade — se a pré-visualização
 * calculasse a geometria por sua conta, mais cedo ou mais tarde mostraria uma
 * coisa e a janela iria para outra.
 */
function SnapPreview({ edge }: { readonly edge: SnapEdge }): React.JSX.Element | null {
  const rect = rectForSnapEdge(edge, readViewport());
  if (!rect) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[49] rounded-card border-2 border-accent/40 bg-accent/[.07] transition-all duration-panel ease-out"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
}

function WindowLoading(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center">
      <CoreLoader label="A carregar o módulo" />
    </div>
  );
}

interface ControlButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly isDanger?: boolean;
}

function ControlButton({
  label,
  onClick,
  children,
  isDanger = false,
}: ControlButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-window-control
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className={cn(
        'flex h-[26px] w-[26px] items-center justify-center rounded-lg text-t3',
        'transition-all duration-hover ease-out hover:bg-card-hover hover:text-t1',
        '[&>svg]:h-[13px] [&>svg]:w-[13px]',
        isDanger && 'hover:bg-danger/[.18] hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}
