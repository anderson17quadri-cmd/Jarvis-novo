import { beforeEach, describe, expect, it } from 'vitest';

import {
  copilot,
  countTasks,
  CROWDED_WINDOWS,
  suggest,
  type CopilotFacts,
} from '@/services/assistant/copilot';
import { getTool, validateArgs } from '@/services/assistant/tools';
import type { Task } from '@/types/task';

/**
 * Modo copiloto (Parte 11).
 *
 * A regra deste ficheiro é a mesma do serviço: uma sugestão parte de um facto
 * medido e propõe uma ação que já existe. Os dois últimos testes são a
 * cobrança dessa promessa.
 */

const CALMO: CopilotFacts = {
  openWindows: 1,
  systemState: 'normal',
  overdueTasks: 0,
  tasksDueToday: 0,
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'uma tarefa',
    priority: 'media',
    dueAt: null,
    tags: [],
    subtasks: [],
    isDone: false,
    createdAt: 0,
    attachments: [],
    ...overrides,
  };
}

beforeEach(() => {
  copilot.reset();
});

describe('quando não há nada a dizer', () => {
  it('um sistema calmo não sugere nada', () => {
    expect(suggest(CALMO)).toEqual([]);
  });

  it('quatro janelas ainda não são muitas', () => {
    expect(suggest({ ...CALMO, openWindows: CROWDED_WINDOWS - 1 })).toEqual([]);
  });

  it('já em modo foco, não se propõe o modo foco', () => {
    const feito = suggest({ ...CALMO, openWindows: 9, systemState: 'foco' });

    expect(feito).toEqual([]);
  });
});

describe('as sugestões', () => {
  it('tarefas fora do prazo, com o número certo', () => {
    const [uma] = suggest({ ...CALMO, overdueTasks: 1 });
    expect(uma?.fact).toBe('Uma tarefa passou do prazo.');

    const [varias] = suggest({ ...CALMO, overdueTasks: 3 });
    expect(varias?.fact).toBe('3 tarefas passaram do prazo.');
  });

  it('as de hoje só aparecem quando não há atrasadas', () => {
    const comAtraso = suggest({ ...CALMO, overdueTasks: 2, tasksDueToday: 4 });

    // Duas linhas sobre tarefas ao mesmo tempo seriam a mesma sugestão dita de
    // duas maneiras.
    expect(comAtraso).toHaveLength(1);
    expect(comAtraso[0]?.id).toBe('tarefas-atrasadas');

    const semAtraso = suggest({ ...CALMO, tasksDueToday: 4 });
    expect(semAtraso[0]?.id).toBe('tarefas-hoje');
  });

  it('muitas janelas propõem o modo foco', () => {
    const [feito] = suggest({ ...CALMO, openWindows: CROWDED_WINDOWS });

    expect(feito?.id).toBe('muitas-janelas');
    expect(feito?.fact).toBe('5 janelas abertas.');
  });

  it('duas coisas ao mesmo tempo dão duas sugestões, a mais urgente primeiro', () => {
    const feito = suggest({ ...CALMO, openWindows: 7, overdueTasks: 1 });

    expect(feito.map((entry) => entry.id)).toEqual(['tarefas-atrasadas', 'muitas-janelas']);
  });
});

describe('a promessa do ficheiro', () => {
  it('**toda a sugestão chama uma ferramenta que existe, com argumentos que ela aceita**', () => {
    const todas = [
      ...suggest({ ...CALMO, overdueTasks: 1 }),
      ...suggest({ ...CALMO, tasksDueToday: 1 }),
      ...suggest({ ...CALMO, openWindows: 9 }),
    ];

    expect(todas.length).toBeGreaterThan(0);

    for (const suggestion of todas) {
      const tool = getTool(suggestion.call.name);
      expect(tool, suggestion.call.name).not.toBeNull();
      if (!tool) continue;

      /*
       * Validar os **argumentos**, e não só o nome.
       *
       * A primeira versão deste teste só confirmava que a ferramenta existia,
       * e passou com um `{ janela: 'tasks' }` num parâmetro chamado `app`. No
       * browser, clicar na sugestão não fazia nada — e o teste dizia que
       * estava tudo bem.
       */
      expect(validateArgs(tool, suggestion.call.args), suggestion.call.name).toBeNull();
    }
  });

  it('nenhuma sugestão propõe uma ferramenta que não se desfaz', () => {
    const todas = [
      ...suggest({ ...CALMO, overdueTasks: 1 }),
      ...suggest({ ...CALMO, tasksDueToday: 1 }),
      ...suggest({ ...CALMO, openWindows: 9 }),
    ];

    for (const suggestion of todas) {
      // Uma sugestão é um convite de um clique. Um convite de um clique não
      // pode custar trabalho que não volta.
      expect(getTool(suggestion.call.name)?.risk, suggestion.call.name).toBe('livre');
    }
  });

  it('**todo o facto tem um número**, e nenhum é uma frase de encorajamento', () => {
    const todas = [
      ...suggest({ ...CALMO, overdueTasks: 2 }),
      ...suggest({ ...CALMO, tasksDueToday: 3 }),
      ...suggest({ ...CALMO, openWindows: 6 }),
    ];

    for (const suggestion of todas) {
      // Um algarismo, ou o "Uma" das contagens de um. O que não pode haver é
      // um facto sem medida por trás.
      expect(/\d|^Uma\b/.test(suggestion.fact), suggestion.fact).toBe(true);
    }
  });
});

describe('dispensar', () => {
  it('uma sugestão dispensada não volta', () => {
    const factos: CopilotFacts = { ...CALMO, overdueTasks: 1 };

    expect(copilot.visible(factos)).toHaveLength(1);

    copilot.dismiss('tarefas-atrasadas');

    expect(copilot.visible(factos)).toHaveLength(0);
  });

  it('dispensar uma não cala as outras', () => {
    const factos: CopilotFacts = { ...CALMO, overdueTasks: 1, openWindows: 8 };

    copilot.dismiss('tarefas-atrasadas');

    expect(copilot.visible(factos).map((entry) => entry.id)).toEqual(['muitas-janelas']);
  });

  it('avisa quem estiver a ouvir', () => {
    let avisos = 0;
    const stop = copilot.subscribe(() => {
      avisos += 1;
    });

    copilot.dismiss('muitas-janelas');
    expect(avisos).toBe(1);

    stop();
    copilot.dismiss('tarefas-hoje');
    expect(avisos).toBe(1);
  });
});

describe('contar tarefas', () => {
  const agora = new Date(2026, 7, 5, 14, 0);

  it('atrasada é a que já passou do prazo', () => {
    const contas = countTasks([task({ dueAt: agora.getTime() - 1_000 })], agora);

    expect(contas).toEqual({ overdueTasks: 1, tasksDueToday: 0 });
  });

  it('**hoje é o dia do calendário**, e não vinte e quatro horas', () => {
    const hoje23h = new Date(2026, 7, 5, 23, 0).getTime();
    const amanha2h = new Date(2026, 7, 6, 2, 0).getTime();

    const contas = countTasks([task({ id: 'a', dueAt: hoje23h }), task({ id: 'b', dueAt: amanha2h })], agora);

    // As duas estão a menos de doze horas de distância, e só uma é de hoje.
    expect(contas).toEqual({ overdueTasks: 0, tasksDueToday: 1 });
  });

  it('as feitas e as sem prazo não contam', () => {
    const contas = countTasks(
      [
        task({ id: 'a', dueAt: agora.getTime() - 1_000, isDone: true }),
        task({ id: 'b', dueAt: null }),
      ],
      agora,
    );

    expect(contas).toEqual({ overdueTasks: 0, tasksDueToday: 0 });
  });
});
