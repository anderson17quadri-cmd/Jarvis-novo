import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { ALL_SYSTEM_STATES } from '@/types/system-state';

/**
 * Escolha do estado do sistema (Parte 9).
 *
 * Cada cartão diz o que o estado faz, não só como se chama: "Foco" sozinho não
 * explica que os avisos deixam de interromper.
 */
export function SystemStatePicker(): React.JSX.Element {
  const current = useSystemStateStore((state) => state.current);
  const setState = useSystemStateStore((state) => state.set);
  const persist = useSystemStateStore((state) => state.persist);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
      role="radiogroup"
      aria-label="Estado do sistema"
    >
      {ALL_SYSTEM_STATES.map((definition) => {
        const Icon = definition.icon;
        const isActive = definition.id === current;

        return (
          <button
            key={definition.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => {
              setState(definition.id);
              void persist();
            }}
            className={cn(
              'rounded-input border border-line p-2.5 text-left transition-all duration-hover ease-out',
              'hover:border-accent/35 hover:bg-accent/[.04]',
              isActive && 'border-accent bg-accent/[.08]',
            )}
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
              <Icon
                className={cn('h-3.5 w-3.5', isActive ? 'text-accent' : 'text-t3')}
                aria-hidden="true"
              />
              {definition.name}
              {isActive && <Check className="ml-auto h-3.5 w-3.5 text-accent" aria-hidden="true" />}
            </span>

            <span className="mt-1 block text-[10.5px] leading-[1.45] text-t3">
              {definition.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
