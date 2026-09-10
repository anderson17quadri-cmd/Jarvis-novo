/** Projetos (Parte 6.1 §Sidebar, Parte 6.2 §Painel esquerdo — projetos recentes). */

import type { Attachment } from './attachment';

export type ProjectStatus = 'ativo' | 'pausado' | 'concluido';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
};

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  /** Entre 0 e 1. */
  readonly progress: number;
  readonly tags: readonly string[];
  /** Milissegundos desde a época Unix. */
  readonly updatedAt: number;
  readonly openTasks: number;
  /** Anexos (11/08/2026). */
  readonly attachments: readonly Attachment[];
}
