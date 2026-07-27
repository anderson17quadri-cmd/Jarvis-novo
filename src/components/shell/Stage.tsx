import { useShallow } from 'zustand/react/shallow';

import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { cn } from '@/lib/cn';
import { selectVisibleWidgets, useWidgetStore } from '@/stores/use-widget-store';

interface StageProps {
  /** O AI Core. Fica ao centro, por trás dos widgets. */
  readonly children: React.ReactNode;
}

/**
 * Área central, entre o header e o fundo do ecrã, à direita do rail.
 *
 * O `left` acompanha `--rail-w`, que a media query dos 820px põe a zero — no
 * compacto o palco passa a ocupar a largura toda sem o componente saber de nada.
 *
 * Com widgets visíveis, o núcleo passa para segundo plano em vez de sair: a
 * Parte 8 diz que "nunca desaparece completamente".
 */
export function Stage({ children }: StageProps): React.JSX.Element {
  const hasWidgets = useWidgetStore(useShallow(selectVisibleWidgets)).length > 0;

  return (
    <div
      className={cn(
        'fixed bottom-0 right-0 top-header z-stage left-[var(--rail-w)]',
        'overflow-y-auto overflow-x-hidden',
      )}
    >
      {/* Núcleo: centrado e sempre presente, atrás da grelha. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex flex-col items-center justify-center',
          'transition-opacity duration-screen ease-out',
          hasWidgets && 'opacity-40',
        )}
      >
        {/* Reativa os eventos só no núcleo, não na camada inteira. */}
        <div className="pointer-events-auto flex flex-col items-center">{children}</div>
      </div>

      <div className="relative z-10 px-s3 py-s3 pb-[120px]">
        <WidgetGrid />
      </div>
    </div>
  );
}
