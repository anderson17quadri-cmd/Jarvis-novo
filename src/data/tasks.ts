import type { Task } from '@/types/task';

/**
 * Tarefas de exemplo.
 *
 * Prazos relativos ao momento em que se lê — ver `data/README.md`. Há
 * deliberadamente uma atrasada, para o estado de atraso ser visível sem ser
 * preciso esperar por ele.
 */

const DAY_MS = 24 * 60 * 60_000;

function inDays(days: number, now: number): number {
  return now + days * DAY_MS;
}

export function seedTasks(now: number = Date.now()): readonly Task[] {
  return [
    {
      id: 't1',
      title: 'Fechar o orçamento do fornecedor de hardware',
      priority: 'alta',
      dueAt: inDays(-1, now),
      tags: ['compras'],
      subtasks: [
        { id: 't1s1', title: 'Comparar as três propostas', isDone: true },
        { id: 't1s2', title: 'Confirmar prazos de entrega', isDone: false },
      ],
      isDone: false,
      createdAt: inDays(-6, now),
    },
    {
      id: 't2',
      title: 'Preparar a demonstração para a Barbearia Silva',
      priority: 'alta',
      dueAt: inDays(2, now),
      tags: ['clientes', 'agendado'],
      subtasks: [
        { id: 't2s1', title: 'Guião da demonstração', isDone: true },
        { id: 't2s2', title: 'Dados de exemplo carregados', isDone: true },
        { id: 't2s3', title: 'Ensaio cronometrado', isDone: false },
      ],
      isDone: false,
      createdAt: inDays(-4, now),
    },
    {
      id: 't3',
      title: 'Rever a política de permissões dos plugins',
      priority: 'media',
      dueAt: inDays(5, now),
      tags: ['segurança'],
      subtasks: [],
      isDone: false,
      createdAt: inDays(-3, now),
    },
    {
      id: 't4',
      title: 'Responder à Voxel Studio sobre a remarcação',
      priority: 'media',
      dueAt: inDays(1, now),
      tags: ['clientes'],
      subtasks: [],
      isDone: false,
      createdAt: inDays(-1, now),
    },
    {
      id: 't5',
      title: 'Escrever as notas da versão 1.0',
      priority: 'baixa',
      dueAt: null,
      tags: ['documentação'],
      subtasks: [],
      isDone: false,
      createdAt: inDays(-8, now),
    },
    {
      id: 't6',
      title: 'Migrar os tokens de cor para o design system',
      priority: 'baixa',
      dueAt: null,
      tags: ['interface'],
      subtasks: [],
      isDone: true,
      createdAt: inDays(-12, now),
    },
  ];
}
