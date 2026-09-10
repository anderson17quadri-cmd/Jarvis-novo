/** Tarefas (Parte 6.2 §Widgets previstos — lista, filtros, prioridade, etiquetas, subtarefas). */

import type { Attachment } from './attachment';

export type TaskPriority = 'alta' | 'media' | 'baixa';

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

/** Ordem de urgência, para ordenar sem depender da ordem das chaves. */
export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  alta: 0,
  media: 1,
  baixa: 2,
};

export interface Subtask {
  readonly id: string;
  readonly title: string;
  readonly isDone: boolean;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly priority: TaskPriority;
  /** Milissegundos desde a época Unix. `null` quando não tem prazo. */
  readonly dueAt: number | null;
  readonly tags: readonly string[];
  readonly subtasks: readonly Subtask[];
  readonly isDone: boolean;
  readonly createdAt: number;
  /** Anexos (11/08/2026). */
  readonly attachments: readonly Attachment[];
}

/**
 * Progresso de uma tarefa, entre 0 e 1.
 *
 * Sem subtarefas, é o próprio estado: 0 ou 1. Com subtarefas, é a fração feita
 * — mas uma tarefa marcada como concluída conta como completa mesmo que
 * alguma subtarefa tenha ficado por marcar, porque foi isso que o utilizador
 * disse.
 */
export function taskProgress(task: Task): number {
  if (task.isDone) return 1;
  if (task.subtasks.length === 0) return 0;

  const done = task.subtasks.filter((subtask) => subtask.isDone).length;
  return done / task.subtasks.length;
}

/** `true` quando o prazo já passou e a tarefa continua por fazer. */
export function isOverdue(task: Task, now: number = Date.now()): boolean {
  return !task.isDone && task.dueAt !== null && task.dueAt < now;
}
