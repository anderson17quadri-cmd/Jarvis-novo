import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/cn';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { DESKTOP_IDS } from '@/types/workspace';

/**
 * Saltar entre desktops (Parte 6.2 §Múltiplos desktops).
 *
 * Quatro marcas, no header, sempre à vista. Um desktop com alguma coisa dentro
 * distingue-se de um por estrear pelo preenchimento — sem números por cima nem
 * legenda, porque a diferença é a de "tem" ou "não tem".
 */
export function DesktopSwitcher(): React.JSX.Element {
  const desktops = useWorkspaceStore((state) => state.desktops);
  const current = useWorkspaceStore((state) => state.current);
  const { goToDesktop } = useWorkspace();

  return (
    <div
      role="group"
      aria-label="Desktops"
      className="flex flex-shrink-0 items-center gap-1 rounded-input border border-line bg-tint/[.03] px-1.5 py-1"
    >
      {DESKTOP_IDS.map((id) => {
        const desktop = desktops.find((entry) => entry.id === id);
        const isActive = id === current;
        const hasContent = (desktop?.snapshot?.windows.length ?? 0) > 0;

        return (
          <button
            key={id}
            type="button"
            onClick={() => goToDesktop(id)}
            aria-current={isActive ? 'true' : undefined}
            aria-label={`${desktop?.name ?? `Desktop ${id}`}${isActive ? ' (atual)' : ''}`}
            className={cn(
              'h-[18px] w-[18px] rounded-[5px] border text-[9px] font-semibold leading-none',
              'transition-all duration-hover ease-out',
              isActive
                ? 'border-accent bg-accent/[.16] text-accent'
                : 'border-line text-t3 hover:border-accent/40 hover:text-t2',
            )}
          >
            {hasContent && !isActive ? (
              <span
                className="mx-auto block h-[5px] w-[5px] rounded-full bg-t3"
                aria-hidden="true"
              />
            ) : (
              id
            )}
          </button>
        );
      })}
    </div>
  );
}
