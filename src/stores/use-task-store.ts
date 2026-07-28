import { create } from 'zustand';

import { seedTasks } from '@/data/tasks';
import { createId } from '@/lib/id';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { TASK_PRIORITY_ORDER, type Task, type TaskPriority } from '@/types/task';

/**
 * Tarefas.
 *
 * Estado local e persistido — não há serviço porque não há fonte externa: as
 * tarefas nascem e morrem aqui. Se um dia vierem de um servidor, entra um
 * `TaskService` com provedor, como no email, e este store passa a espelho.
 */

interface TaskState {
  readonly tasks: readonly Task[];
  /** `false` até a primeira leitura do armazenamento. */
  readonly isHydrated: boolean;

  add: (title: string, priority: TaskPriority) => void;
  toggle: (id: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  remove: (id: string) => void;
  /** Apaga as concluídas de uma vez. */
  clearDone: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isHydrated: false,

  add: (title, priority) =>
    set((state) => {
      const trimmed = title.trim();
      // Uma tarefa sem título seria uma linha em branco na lista para sempre.
      if (trimmed.length === 0) return state;

      const task: Task = {
        id: createId('task'),
        title: trimmed,
        priority,
        dueAt: null,
        tags: [],
        subtasks: [],
        isDone: false,
        createdAt: Date.now(),
      };

      return { tasks: [task, ...state.tasks] };
    }),

  toggle: (id) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, isDone: !task.isDone } : task,
      ),
    })),

  toggleSubtask: (taskId, subtaskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, isDone: !subtask.isDone } : subtask,
              ),
            }
          : task,
      ),
    })),

  remove: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),

  clearDone: () => set((state) => ({ tasks: state.tasks.filter((task) => !task.isDone) })),

  persist: async () => {
    await storageService.set(STORAGE_KEYS.tasks, get().tasks);
  },

  hydrate: async () => {
    // `null` distingue "nunca gravado" de "gravado vazio". Sem esta diferença,
    // apagar a última tarefa e reabrir a janela ressuscitava as de exemplo.
    const saved = await storageService.get<Task[] | null>(STORAGE_KEYS.tasks, null);
    set({ tasks: saved ?? seedTasks(), isHydrated: true });
  },
}));

/**
 * Por urgência: primeiro as por fazer, depois por prioridade, depois por prazo.
 *
 * Uma tarefa sem prazo vai para o fim do seu grupo — não tem urgência
 * atribuída, e pô-la antes de uma com prazo seria enganador.
 */
export function sortByUrgency(tasks: readonly Task[]): readonly Task[] {
  return [...tasks].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;

    const priority = TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
    if (priority !== 0) return priority;

    if (a.dueAt === b.dueAt) return 0;
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt - b.dueAt;
  });
}
