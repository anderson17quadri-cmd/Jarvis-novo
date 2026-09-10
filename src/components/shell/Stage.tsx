import { useShallow } from 'zustand/react/shallow';

import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { cn } from '@/lib/cn';
import { selectVisibleWidgets, useWidgetStore } from '@/stores/use-widget-store';

interface StageProps {
  /** O AI Core. É o centro do ambiente de trabalho, não um fundo. */
  readonly children: React.ReactNode;
}

/**
 * Área central, entre o header e o fundo do ecrã, à direita do rail.
 *
 * O `left` acompanha `--rail-w`, que a media query dos 820px põe a zero — no
 * compacto o palco passa a ocupar a largura toda sem o componente saber de nada.
 *
 * **O núcleo vem primeiro e ocupa o seu próprio espaço.** No protótipo o palco
 * é só ele, centrado; a grelha de widgets foi acrescentada depois e não pode
 * tomar-lhe o lugar. Sem widgets, o núcleo fica centrado no palco, como no
 * protótipo. Com widgets, encosta ao topo e a grelha desce para baixo dele —
 * nunca por cima. As Partes 6.1 e 8 são explícitas: o núcleo é o elemento
 * principal e permanece sempre visível.
 *
 * A única redução prevista é a das janelas abertas (75%), tratada no próprio
 * `AICore`.
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
      <div className="flex min-h-full flex-col">
        <div
          className={cn(
            // Coluna, não linha: o `AICore` devolve o núcleo e a etiqueta de
            // estado como irmãos, e em linha disputavam a largura — o núcleo
            // encolhia para caber ao lado da etiqueta.
            'flex flex-shrink-0 flex-col items-center justify-center',
            // Sem widgets, o núcleo toma o palco todo e fica ao centro.
            // Com widgets, fica no cimo, com folga à volta.
            hasWidgets ? 'py-s3' : 'flex-1',
          )}
        >
          {children}
        </div>

        {hasWidgets && (
          <div className="px-s3 pb-[120px]">
            <WidgetGrid />
          </div>
        )}
      </div>
    </div>
  );
}
