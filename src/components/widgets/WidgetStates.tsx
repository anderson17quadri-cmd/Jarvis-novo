import { Inbox, TriangleAlert } from 'lucide-react';

import { CoreLoader } from '@/components/ui/CoreLoader';
import { cn } from '@/lib/cn';

/**
 * Estados obrigatórios de um widget (Parte 6.2 §Estrutura).
 *
 * Juntos num ficheiro por serem três variações da mesma coisa — uma mensagem
 * centrada no corpo do widget. Separá-los em três ficheiros de dez linhas seria
 * dispersão sem ganho.
 */

const SHELL = 'flex h-full flex-col items-center justify-center gap-2 px-3 text-center';

/** Carregamento. Usa o mesmo loader das janelas, para a linguagem ser uma só. */
export function WidgetSkeleton(): React.JSX.Element {
  return (
    <div className={SHELL}>
      <CoreLoader size={32} label="" />
    </div>
  );
}

/** Sem dados para mostrar — diferente de erro, e tem de se ler como tal. */
export function WidgetEmpty({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <div className={SHELL}>
      <Inbox className="h-6 w-6 text-t3" aria-hidden="true" />
      <p className="text-[11.5px] leading-[1.5] text-t3">{message}</p>
    </div>
  );
}

interface WidgetErrorProps {
  readonly message: string;
  /** Sem função de repetir, o botão não aparece — um botão que não faz nada é pior que nenhum. */
  readonly onRetry?: () => void;
}

export function WidgetError({ message, onRetry }: WidgetErrorProps): React.JSX.Element {
  return (
    <div className={SHELL} role="alert">
      <TriangleAlert className="h-6 w-6 text-danger" aria-hidden="true" />
      <p className="text-[11.5px] leading-[1.5] text-t2">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-1 rounded-btn border border-line px-3 py-1.5 text-[11px] text-t2',
            'transition-all duration-hover ease-out hover:border-accent/35 hover:text-accent',
          )}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
