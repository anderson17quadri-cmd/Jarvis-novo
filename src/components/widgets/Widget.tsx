import { Suspense, useState } from 'react';
import { Maximize2, X } from 'lucide-react';

import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetSizeName } from '@/types/widget';
import { WidgetEmpty, WidgetSkeleton } from './WidgetStates';

interface WidgetProps {
  readonly definition: WidgetDefinition;
  /** `true` enquanto está a ser arrastado. */
  readonly isDragging: boolean;
  readonly onHide: () => void;
  readonly onResize: (size: WidgetSizeName) => void;
  readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Moldura de um widget: cabeçalho, corpo e ações.
 *
 * Não sabe o que o widget mostra — só lhe dá o sítio, o ciclo de vida e os
 * estados. O conteúdo vem do registo, carregado sob demanda.
 */
export function Widget({
  definition,
  isDragging,
  onHide,
  onResize,
  onPointerDown,
}: WidgetProps): React.JSX.Element {
  const capabilities = useCapabilities();
  const [isSizeMenuOpen, setSizeMenuOpen] = useState(false);

  const Icon = definition.icon;
  const Content = definition.component;

  /*
   * Um widget que precise de algo que a plataforma não tem não chega a ser
   * montado. Mostrar a moldura com uma explicação é mais honesto do que montar
   * um componente que vai falhar por dentro.
   */
  const missingMetrics = definition.permissions.systemMetrics && !capabilities.systemMetrics;

  return (
    <section
      aria-label={definition.name}
      className={cn(
        'group/widget flex h-full flex-col overflow-hidden rounded-card border border-line',
        'bg-[rgb(16_25_34_/_0.74)] backdrop-blur-panel',
        'transition-[transform,box-shadow,border-color] duration-panel ease-out',
        // Hover: eleva 4px, glow discreto, borda mais clara (Parte 6.2).
        !isDragging && 'hover:-translate-y-1 hover:border-accent/25 hover:shadow-glow',
        isDragging && 'scale-[1.02] border-accent/40 opacity-95 shadow-2',
      )}
    >
      <header
        onPointerDown={onPointerDown}
        className={cn(
          'flex h-9 flex-shrink-0 select-none items-center gap-2 border-b border-line px-3',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <Icon className="h-[15px] w-[15px] flex-shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1 truncate text-[12px] font-medium">{definition.name}</span>

        {/* As ações só aparecem no hover, para o cabeçalho respirar. */}
        <div className="flex gap-0.5 opacity-0 transition-opacity duration-hover group-hover/widget:opacity-100 focus-within:opacity-100">
          {definition.allowedSizes.length > 1 && (
            <div className="relative">
              <WidgetAction
                label={`Redimensionar ${definition.name}`}
                onClick={() => setSizeMenuOpen((open) => !open)}
              >
                <Maximize2 />
              </WidgetAction>

              {isSizeMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-10 mt-1 min-w-[112px] rounded-input border border-line-2 bg-[rgb(16_25_34_/_0.96)] p-1 shadow-2 backdrop-blur-panel"
                >
                  {definition.allowedSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onResize(size);
                        setSizeMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] text-t2 transition-colors hover:bg-accent/10 hover:text-accent"
                    >
                      {SIZE_LABELS[size]}
                      <span className="mono text-[10px] text-t3">
                        {WIDGET_SIZES[size].colSpan}×{WIDGET_SIZES[size].rowSpan}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <WidgetAction label={`Esconder ${definition.name}`} onClick={onHide} isDanger>
            <X />
          </WidgetAction>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {missingMetrics ? (
          <WidgetEmpty message="Esta plataforma não expõe métricas do sistema." />
        ) : (
          <Suspense fallback={<WidgetSkeleton />}>
            <Content />
          </Suspense>
        )}
      </div>
    </section>
  );
}

const SIZE_LABELS: Record<WidgetSizeName, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  wide: 'Largo',
  large: 'Grande',
};

interface WidgetActionProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly isDanger?: boolean;
}

function WidgetAction({
  label,
  onClick,
  children,
  isDanger = false,
}: WidgetActionProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      // O cabeçalho arrasta; um clique num botão não pode arrastar o widget.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md text-t3',
        'transition-all duration-hover ease-out hover:bg-card-hover hover:text-t1',
        '[&>svg]:h-3 [&>svg]:w-3',
        isDanger && 'hover:bg-danger/[.18] hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}
