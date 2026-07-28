import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import { sortByUrgency, useTaskStore } from '@/stores/use-task-store';
import {
  isOverdue,
  taskProgress,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskPriority,
} from '@/types/task';

/** Vistas da lista. */
type Filter = 'todas' | 'abertas' | 'concluidas';

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  alta: 'bg-danger/[.12] text-danger',
  media: 'bg-warn/[.12] text-warn',
  baixa: 'bg-tint/[.06] text-t3',
};

/**
 * Tarefas.
 *
 * Lista, prioridade, prazo, etiquetas, subtarefas e progresso (Parte 6.2). O
 * estado vive no `useTaskStore` e persiste — fechar a janela não perde nada.
 */
export default function TasksWindow(): React.JSX.Element {
  const tasks = useTaskStore((state) => state.tasks);
  const add = useTaskStore((state) => state.add);
  const toggle = useTaskStore((state) => state.toggle);
  const toggleSubtask = useTaskStore((state) => state.toggleSubtask);
  const remove = useTaskStore((state) => state.remove);
  const clearDone = useTaskStore((state) => state.clearDone);
  const persist = useTaskStore((state) => state.persist);
  const hydrate = useTaskStore((state) => state.hydrate);
  const isHydrated = useTaskStore((state) => state.isHydrated);

  const [filter, setFilter] = useState<Filter>('abertas');
  const [draft, setDraft] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('media');

  // A janela é `lazy`: a primeira abertura pode acontecer antes de qualquer
  // hidratação. Pedir aqui evita depender da ordem de arranque, e a bandeira
  // impede que reabrir a janela com a lista vazia traga as tarefas de exemplo
  // de volta.
  useEffect(() => {
    if (!isHydrated) void hydrate();
  }, [hydrate, isHydrated]);

  const visible = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (filter === 'abertas') return !task.isDone;
      if (filter === 'concluidas') return task.isDone;
      return true;
    });

    return sortByUrgency(filtered);
  }, [filter, tasks]);

  const openCount = tasks.filter((task) => !task.isDone).length;
  const doneCount = tasks.length - openCount;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    add(draft, priority);
    void persist();
    setDraft('');
  };

  return (
    <div className="flex h-full flex-col gap-s2">
      <form onSubmit={submit} className="flex flex-shrink-0 flex-wrap gap-1.5">
        <label className="min-w-[140px] flex-1">
          <span className="sr-only">Nova tarefa</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nova tarefa…"
            className={cn(
              'w-full rounded-input border border-line bg-tint/[.03] px-2.5 py-2',
              'text-[12.5px] outline-none transition-colors duration-hover',
              'placeholder:text-t3 focus:border-accent/45',
            )}
          />
        </label>

        <label>
          <span className="sr-only">Prioridade da nova tarefa</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className={cn(
              'rounded-input border border-line bg-glass px-2 py-2',
              'text-[12px] text-t2 outline-none focus:border-accent/45',
            )}
          >
            {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((id) => (
              <option key={id} value={id}>
                {TASK_PRIORITY_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          aria-label="Acrescentar tarefa"
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border border-accent/50 bg-accent/[.1] px-3',
            'text-[12px] font-medium text-accent transition-all duration-hover ease-out',
            'hover:bg-accent/[.16] active:scale-[.98] compact:min-h-[44px]',
          )}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Juntar
        </button>
      </form>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
        <FilterChip isActive={filter === 'abertas'} onClick={() => setFilter('abertas')}>
          Abertas ({openCount})
        </FilterChip>
        <FilterChip isActive={filter === 'concluidas'} onClick={() => setFilter('concluidas')}>
          Concluídas ({doneCount})
        </FilterChip>
        <FilterChip isActive={filter === 'todas'} onClick={() => setFilter('todas')}>
          Todas
        </FilterChip>

        {doneCount > 0 && (
          <button
            type="button"
            onClick={() => {
              clearDone();
              void persist();
            }}
            className="ml-auto text-[11px] text-t3 transition-colors duration-hover hover:text-danger"
          >
            Limpar concluídas
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {visible.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={() => {
              toggle(task.id);
              void persist();
            }}
            onToggleSubtask={(subtaskId) => {
              toggleSubtask(task.id, subtaskId);
              void persist();
            }}
            onRemove={() => {
              remove(task.id);
              void persist();
            }}
          />
        ))}

        {visible.length === 0 && (
          <li className="py-s3 text-center text-desc text-t3">
            {filter === 'abertas' ? 'Nada por fazer. Bom sinal.' : 'Nada nesta vista.'}
          </li>
        )}
      </ul>
    </div>
  );
}

interface TaskRowProps {
  readonly task: Task;
  readonly onToggle: () => void;
  readonly onToggleSubtask: (subtaskId: string) => void;
  readonly onRemove: () => void;
}

function TaskRow({ task, onToggle, onToggleSubtask, onRemove }: TaskRowProps): React.JSX.Element {
  const progress = taskProgress(task);
  const overdue = isOverdue(task);

  return (
    <li className="rounded-input border border-line bg-tint/[.02] p-2.5">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.isDone}
          aria-label={task.title}
          onClick={onToggle}
          className={cn(
            'mt-px flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[6px] border',
            'transition-all duration-hover ease-out',
            task.isDone
              ? 'border-accent bg-accent/[.15] text-accent'
              : 'border-line hover:border-accent/50',
          )}
        >
          {task.isDone && <Check className="h-3 w-3" aria-hidden="true" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[12.5px] leading-snug', task.isDone && 'text-t3 line-through')}>
            {task.title}
          </p>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px]">
            <span className={cn('rounded-full px-1.5 py-px', PRIORITY_STYLE[task.priority])}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </span>

            {task.dueAt !== null && (
              <span className={cn(overdue ? 'text-danger' : 'text-t3')}>
                {overdue ? 'Atrasada · ' : ''}
                {formatShortDate(new Date(task.dueAt))}
              </span>
            )}

            {task.tags.map((tag) => (
              <span key={tag} className="text-t3">
                #{tag}
              </span>
            ))}
          </p>

          {task.subtasks.length > 0 && (
            <>
              <div
                className="mt-2 h-[3px] overflow-hidden rounded-full bg-tint/[.06]"
                role="progressbar"
                aria-label={`Progresso de ${task.title}`}
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon to-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              <ul className="mt-1.5 space-y-1">
                {task.subtasks.map((subtask) => (
                  <li key={subtask.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={subtask.isDone}
                      aria-label={subtask.title}
                      onClick={() => onToggleSubtask(subtask.id)}
                      className="flex items-center gap-1.5 text-left text-[11px] text-t3 transition-colors duration-hover hover:text-t2"
                    >
                      <span
                        className={cn(
                          'flex h-[13px] w-[13px] flex-shrink-0 items-center justify-center rounded-[4px] border',
                          subtask.isDone ? 'border-accent/60 text-accent' : 'border-line',
                        )}
                        aria-hidden="true"
                      >
                        {subtask.isDone && <Check className="h-[9px] w-[9px]" />}
                      </span>
                      <span className={cn(subtask.isDone && 'line-through')}>{subtask.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Apagar: ${task.title}`}
          className="flex-shrink-0 rounded p-1 text-t3 transition-colors duration-hover hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function FilterChip({
  isActive,
  onClick,
  children,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] transition-all duration-hover ease-out',
        isActive
          ? 'border-accent/60 bg-accent/[.1] text-accent'
          : 'border-line text-t3 hover:border-accent/30 hover:text-t2',
      )}
    >
      {children}
    </button>
  );
}
