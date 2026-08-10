import { beforeEach, describe, expect, it } from 'vitest';

import { sortByUrgency, useTaskStore } from '@/stores/use-task-store';
import type { Task } from '@/types/task';
import { isOverdue, taskProgress } from '@/types/task';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'x',
    title: 'Tarefa',
    priority: 'media',
    dueAt: null,
    tags: [],
    subtasks: [],
    isDone: false,
    createdAt: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  localStorage.clear();
  useTaskStore.setState({ tasks: [], isHydrated: false });
  await useTaskStore.getState().hydrate();
});

describe('estado das tarefas', () => {
  it('sem nada guardado, começa com as de exemplo', () => {
    expect(useTaskStore.getState().tasks.length).toBeGreaterThan(0);
  });

  it('apagar tudo e recarregar não ressuscita as de exemplo', async () => {
    for (const task of useTaskStore.getState().tasks) useTaskStore.getState().remove(task.id);
    await useTaskStore.getState().persist();

    useTaskStore.setState({ tasks: [], isHydrated: false });
    await useTaskStore.getState().hydrate();

    // "Gravado vazio" e "nunca gravado" são coisas diferentes.
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });

  it('as novas entram no topo', () => {
    useTaskStore.getState().add('Primeira', 'alta');
    useTaskStore.getState().add('Segunda', 'baixa');

    expect(useTaskStore.getState().tasks[0]?.title).toBe('Segunda');
  });

  it('o título é aparado, e um só de espaços não entra', () => {
    const before = useTaskStore.getState().tasks.length;

    useTaskStore.getState().add('   ', 'media');
    expect(useTaskStore.getState().tasks).toHaveLength(before);

    useTaskStore.getState().add('  Com espaços  ', 'media');
    expect(useTaskStore.getState().tasks[0]?.title).toBe('Com espaços');
  });

  it('sem prazo indicado, dueAt fica null (omisso)', () => {
    useTaskStore.getState().add('Sem prazo', 'media');
    expect(useTaskStore.getState().tasks[0]?.dueAt).toBeNull();
  });

  it('um prazo passado ao add() fica guardado na tarefa', () => {
    const amanha = Date.now() + 24 * 60 * 60 * 1000;
    useTaskStore.getState().add('Com prazo', 'media', amanha);
    expect(useTaskStore.getState().tasks[0]?.dueAt).toBe(amanha);
  });

  it('marcar uma subtarefa não mexe nas outras tarefas', () => {
    const withSubtasks = useTaskStore
      .getState()
      .tasks.find((task) => task.subtasks.length > 0);
    expect(withSubtasks).toBeDefined();

    const otherBefore = useTaskStore.getState().tasks.filter((t) => t.id !== withSubtasks!.id);
    useTaskStore.getState().toggleSubtask(withSubtasks!.id, withSubtasks!.subtasks[0]!.id);
    const otherAfter = useTaskStore.getState().tasks.filter((t) => t.id !== withSubtasks!.id);

    expect(otherAfter).toEqual(otherBefore);
  });

  it('limpar concluídas deixa as abertas', () => {
    const openBefore = useTaskStore.getState().tasks.filter((task) => !task.isDone).length;
    useTaskStore.getState().clearDone();

    expect(useTaskStore.getState().tasks).toHaveLength(openBefore);
    expect(useTaskStore.getState().tasks.every((task) => !task.isDone)).toBe(true);
  });
});

describe('ordenação por urgência', () => {
  it('as concluídas vão para o fim', () => {
    const sorted = sortByUrgency([
      makeTask({ id: 'a', isDone: true, priority: 'alta' }),
      makeTask({ id: 'b', isDone: false, priority: 'baixa' }),
    ]);

    expect(sorted.map((task) => task.id)).toEqual(['b', 'a']);
  });

  it('entre abertas, manda a prioridade', () => {
    const sorted = sortByUrgency([
      makeTask({ id: 'baixa', priority: 'baixa' }),
      makeTask({ id: 'alta', priority: 'alta' }),
      makeTask({ id: 'media', priority: 'media' }),
    ]);

    expect(sorted.map((task) => task.id)).toEqual(['alta', 'media', 'baixa']);
  });

  it('com a mesma prioridade, o prazo mais próximo vem primeiro', () => {
    const sorted = sortByUrgency([
      makeTask({ id: 'depois', dueAt: 2_000 }),
      makeTask({ id: 'antes', dueAt: 1_000 }),
    ]);

    expect(sorted.map((task) => task.id)).toEqual(['antes', 'depois']);
  });

  it('sem prazo fica atrás de quem tem — não tem urgência atribuída', () => {
    const sorted = sortByUrgency([
      makeTask({ id: 'sem-prazo', dueAt: null }),
      makeTask({ id: 'com-prazo', dueAt: 5_000 }),
    ]);

    expect(sorted.map((task) => task.id)).toEqual(['com-prazo', 'sem-prazo']);
  });
});

describe('progresso e atraso', () => {
  it('sem subtarefas, o progresso é o próprio estado', () => {
    expect(taskProgress(makeTask({ isDone: false }))).toBe(0);
    expect(taskProgress(makeTask({ isDone: true }))).toBe(1);
  });

  it('com subtarefas, é a fração feita', () => {
    const task = makeTask({
      subtasks: [
        { id: '1', title: 'a', isDone: true },
        { id: '2', title: 'b', isDone: false },
        { id: '3', title: 'c', isDone: false },
      ],
    });

    expect(taskProgress(task)).toBeCloseTo(1 / 3);
  });

  it('uma tarefa dada como feita conta como completa, mesmo com subtarefas por marcar', () => {
    const task = makeTask({
      isDone: true,
      subtasks: [{ id: '1', title: 'a', isDone: false }],
    });

    // Foi o utilizador que a deu por terminada; a interface não o contradiz.
    expect(taskProgress(task)).toBe(1);
  });

  it('só está atrasada se o prazo passou e continua por fazer', () => {
    const now = 10_000;

    expect(isOverdue(makeTask({ dueAt: 5_000 }), now)).toBe(true);
    expect(isOverdue(makeTask({ dueAt: 20_000 }), now)).toBe(false);
    expect(isOverdue(makeTask({ dueAt: 5_000, isDone: true }), now)).toBe(false);
    expect(isOverdue(makeTask({ dueAt: null }), now)).toBe(false);
  });
});
