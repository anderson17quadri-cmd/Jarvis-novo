import { cn } from '@/lib/cn';

interface StageProps {
  readonly children: React.ReactNode;
}

/**
 * Área central, entre o header e o fundo do ecrã, à direita do rail.
 *
 * O `left` acompanha `--rail-w`, que a media query dos 820px põe a zero — no
 * compacto o palco passa a ocupar a largura toda sem o componente saber de nada.
 */
export function Stage({ children }: StageProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'fixed bottom-0 right-0 top-header z-stage flex flex-col items-center justify-center',
        'left-[var(--rail-w)]',
      )}
    >
      {children}
    </div>
  );
}
