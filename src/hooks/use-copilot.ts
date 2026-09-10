import { useMemo, useSyncExternalStore } from 'react';

import {
  copilot,
  countTasks,
  visibleSuggestions,
  type Suggestion,
} from '@/services/assistant/copilot';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { useTaskStore } from '@/stores/use-task-store';
import { useWindowStore } from '@/stores/use-window-store';
import { useClock } from './use-clock';

/**
 * Junta os factos e devolve o que há a sugerir (Parte 11).
 *
 * As regras não conhecem stores nenhumas — é aqui que se lê o sistema e se
 * transforma em números. Assim o `copilot.ts` testa-se com quatro inteiros, e
 * esta camada é a única que tem de mudar se um facto passar a vir de outro
 * sítio.
 */
export function useCopilot(): {
  readonly suggestions: readonly Suggestion[];
  readonly dismiss: (id: string) => void;
} {
  const windowCount = useWindowStore((state) => state.windows.length);
  const systemState = useSystemStateStore((state) => state.current);
  const tasks = useTaskStore((state) => state.tasks);

  // O relógio do sistema, que já bate de minuto a minuto: um prazo que passa
  // enquanto se está a olhar tem de mudar a sugestão sem se tocar em nada.
  const now = useClock();

  /*
   * As dispensadas entram na filtragem, e não só nas dependências.
   *
   * A primeira versão chamava um `copilot.visible` que lia a lista por dentro,
   * e o `useMemo` não tinha como saber que ela mudara: dispensar avisava o
   * React, o memo devolvia a lista antiga, e o botão parecia não fazer nada.
   * Só se via ao dispensar — ao **aceitar**, a ação mudava o sistema e isso
   * recalculava a lista por outra via.
   */
  const dismissedIds = useSyncExternalStore(
    (onChange) => copilot.subscribe(onChange),
    () => copilot.dismissedIds,
  );

  const suggestions = useMemo(() => {
    const counts = countTasks(tasks, now);
    return visibleSuggestions({ openWindows: windowCount, systemState, ...counts }, dismissedIds);
  }, [dismissedIds, now, systemState, tasks, windowCount]);

  return { suggestions, dismiss: (id) => copilot.dismiss(id) };
}
