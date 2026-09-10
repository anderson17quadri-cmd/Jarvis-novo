import { useEffect } from 'react';
import { Check } from 'lucide-react';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { cn } from '@/lib/cn';
import { useTaskStore } from '@/stores/use-task-store';
import { isOverdue, TASK_PRIORITY_ORDER } from '@/types/task';

/**
 * Tarefas (Parte 6.2 §Widgets previstos).
 *
 * As mesmas tarefas da janela, do mesmo store: marcar aqui marca lá. Mostra as
 * que faltam, pela urgência, com as atrasadas assinaladas.
 */
export default function TasksWidget(): React.JSX.Element {
  const tasks = useTaskStore((state) => state.tasks);
  const isHydrated = useTaskStore((state) => state.isHydrated);
  const toggle = useTaskStore((state) => state.toggle);
  const persist = useTaskStore((state) => state.persist);

  // O widget pode ser a primeira coisa a precisar das tarefas — a janela pode
  // nunca ter sido aberta.
  useEffect(() => {
    if (!isHydrated) void useTaskStore.getState().hydrate();
  }, [isHydrated]);

  if (!isHydrated) return <WidgetSkeleton />;

  const pending = [...tasks]
    .filter((task) => !task.isDone)
    .sort((a, b) => {
      // Atrasadas primeiro, depois pela prioridade: um prazo que já passou é
      // mais urgente do que uma prioridade alta sem data.
      const overdue = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdue !== 0) return overdue;
      return TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
    });

  const doneCount = tasks.length - pending.length;

  if (tasks.length === 0) return <WidgetEmpty message="Sem tarefas por agora." />;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-shrink-0 items-baseline gap-2">
        <span className="mono text-[22px] font-light leading-none compact:text-[18px]">
          {pending.length}
        </span>
        <span className="text-[11px] text-t2">por fazer</span>
        {doneCount > 0 && (
          <span className="ml-auto rounded-full bg-ok/[.12] px-2 py-0.5 text-[10px] text-ok">
            {doneCount} {doneCount === 1 ? 'concluída' : 'concluídas'}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <WidgetEmpty message="Está tudo feito." />
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {pending.map((task) => {
            const late = isOverdue(task);

            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => {
                    toggle(task.id);
                    void persist();
                  }}
                  aria-label={`Concluir: ${task.title}`}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border border-transparent p-1.5 text-left',
                    'transition-colors hover:border-line hover:bg-tint/[.03]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[5px] border',
                      'border-line text-transparent transition-colors',
                      'group-hover:border-accent/50',
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[11.5px]">{task.title}</span>

                  <span
                    className={cn(
                      'h-[5px] w-[5px] flex-shrink-0 rounded-full',
                      task.priority === 'alta' && 'bg-danger',
                      task.priority === 'media' && 'bg-warn',
                      task.priority === 'baixa' && 'bg-t3',
                    )}
                    aria-label={`Prioridade ${task.priority}`}
                  />

                  {late && (
                    <span className="flex-shrink-0 text-[9.5px] text-danger">atrasada</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
