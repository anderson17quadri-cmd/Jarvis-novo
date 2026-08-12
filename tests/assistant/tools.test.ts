import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_APPS } from '@/apps/registry';
import { logService } from '@/services/log-service';
import {
  runTool,
  setToolExecutor,
  describe as describeCall,
  type ToolExecutor,
} from '@/services/assistant/tool-runner';
import {
  DESTRUCTIVE_TOOLS,
  getTool,
  TOOLS,
  toolsAsJsonSchema,
  validateArgs,
} from '@/services/assistant/tools';

/** Um executor que só regista o que lhe pedem. */
function makeExecutor(): ToolExecutor & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    openWindow: (app) => void calls.push(`abrir:${app}`),
    closeWindow: (app) => void calls.push(`fechar:${app}`),
    closeAllWindows: () => void calls.push('fechar-tudo'),
    setTheme: (theme) => void calls.push(`tema:${theme}`),
    setWallpaper: (wallpaper) => void calls.push(`papel:${wallpaper}`),
    setSystemState: (state) => void calls.push(`estado:${state}`),
    setWidgetVisible: (widget, show) => void calls.push(`widget:${widget}:${show ? 'on' : 'off'}`),
    goToDesktop: (desktop) => void calls.push(`desktop:${desktop}`),
    applyLayout: (layout) => {
      calls.push(`layout:${layout}`);
      return layout !== 'inexistente';
    },
    saveLayout: (name) => void calls.push(`guardar-layout:${name}`),
    createTask: (title, priority, dueAt) => void calls.push(`tarefa:${title}:${priority}:${dueAt}`),
    completeTask: (title) => {
      calls.push(`concluir:${title}`);
      return title !== 'inexistente';
    },
    clearDoneTasks: () => {
      calls.push('limpar-concluidas');
      return 3;
    },
    notify: (title) => void calls.push(`notificar:${title}`),
    search: (query) => void calls.push(`procurar:${query}`),
    searchFiles: (query) => {
      calls.push(`procurar-ficheiro:${query}`);
      return query === 'inexistente' ? [] : [{ name: query, pathNames: ['Documentos'] }];
    },
    openFileLocation: (query) => {
      calls.push(`abrir-ficheiro:${query}`);
      return query !== 'inexistente';
    },
    music: (action) => void calls.push(`musica:${action}`),
    speak: (text) => void calls.push(`falar:${text}`),
    setAutomationEnabled: (name, enabled) => {
      calls.push(`automacao:${name}:${enabled ? 'on' : 'off'}`);
      return name !== 'inexistente';
    },
    runAutomation: (name) => {
      calls.push(`correr:${name}`);
      return name !== 'inexistente';
    },
    clearConversations: () => void calls.push('apagar-conversas'),
    forgetMemory: () => void calls.push('esquecer'),
    resetWidgets: () => void calls.push('repor-widgets'),
  };
}

let executor: ReturnType<typeof makeExecutor>;
let unregister: () => void;

beforeEach(() => {
  logService.clear();
  executor = makeExecutor();
  unregister = setToolExecutor(executor);
});

describe('catálogo', () => {
  it('cada ferramenta tem nome único', () => {
    const names = new Set(TOOLS.map((tool) => tool.name));
    expect(names.size).toBe(TOOLS.length);
  });

  it('cada uma diz o que faz, com detalhe que chegue para o modelo escolher', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
    }
  });

  it('os nomes são em português, como o resto do sistema', () => {
    for (const tool of TOOLS) {
      expect(tool.name, tool.name).toMatch(/^[a-z_]+$/);
    }
  });

  it('as opções vêm dos registos — uma janela nova aparece sem se editar o catálogo', () => {
    const abrir = getTool('abrir_janela');
    const options = abrir?.parameters[0]?.options ?? [];

    for (const app of ALL_APPS) expect(options, app.id).toContain(app.id);
  });

  it('a lista das que perdem dados é esta, e mais nenhuma', () => {
    // Escrita por extenso de propósito: acrescentar uma destrutiva passa a ser
    // uma decisão que aparece no diff, não uma que passa despercebida.
    expect([...DESTRUCTIVE_TOOLS].sort()).toEqual([
      'apagar_conversas',
      'apagar_tarefas_concluidas',
      'esquecer_memoria',
      'repor_widgets',
    ]);

    for (const name of DESTRUCTIVE_TOOLS) {
      const tool = getTool(name);
      expect(tool?.confirmation, name).toBeDefined();
      expect(tool?.confirmation?.({}).length, name).toBeGreaterThan(20);
    }
  });

  it('as que não perdem nada não pedem confirmação — um assistente que pergunta sempre desliga-se', () => {
    for (const tool of TOOLS.filter((entry) => entry.risk === 'livre')) {
      expect(tool.confirmation, tool.name).toBeUndefined();
    }
  });
});

describe('o que se manda ao modelo', () => {
  it('todas as ferramentas vão no esquema', () => {
    expect(toolsAsJsonSchema()).toHaveLength(TOOLS.length);
  });

  it('as opções viram um enum, para o modelo não inventar valores', () => {
    const schema = toolsAsJsonSchema() as {
      function: { name: string; parameters: { properties: Record<string, { enum?: string[] }> } };
    }[];

    const abrir = schema.find((entry) => entry.function.name === 'abrir_janela');
    expect(abrir?.function.parameters.properties['app']?.enum).toContain('emails');
  });

  it('os campos opcionais não entram nos obrigatórios', () => {
    const schema = toolsAsJsonSchema() as {
      function: { name: string; parameters: { required: string[] } };
    }[];

    const tarefa = schema.find((entry) => entry.function.name === 'criar_tarefa');
    expect(tarefa?.function.parameters.required).toEqual(['titulo']);
  });
});

describe('validação', () => {
  it('um argumento em falta é apanhado antes de chegar ao executor', () => {
    expect(runTool({ id: '1', name: 'abrir_janela', args: {} }).status).toBe('erro');
    expect(executor.calls).toEqual([]);
  });

  it('um valor fora das opções não passa', () => {
    const outcome = runTool({ id: '1', name: 'mudar_estado_do_sistema', args: { estado: 'turbo' } });

    expect(outcome.status).toBe('erro');
    expect(outcome.message).toContain('turbo');
    expect(executor.calls).toEqual([]);
  });

  it('um número escrito como texto não passa por número', () => {
    expect(
      runTool({ id: '1', name: 'mudar_de_desktop', args: { desktop: 'dois' } }).status,
    ).toBe('erro');
  });

  it('um campo opcional em falta não é erro', () => {
    expect(validateArgs(getTool('criar_tarefa')!, { titulo: 'x' })).toBeNull();
  });
});

describe('executar', () => {
  it('uma ferramenta simples chega ao executor', () => {
    const outcome = runTool({ id: '1', name: 'abrir_janela', args: { app: 'emails' } });

    expect(outcome.status).toBe('ok');
    expect(executor.calls).toEqual(['abrir:emails']);
  });

  it('a resposta diz ao modelo quando não encontrou nada', () => {
    const outcome = runTool({ id: '1', name: 'concluir_tarefa', args: { titulo: 'inexistente' } });

    // "Ok" com uma mensagem que explica: o modelo lê e pergunta, em vez de
    // dizer que fez.
    expect(outcome.message).toContain('Não encontrei');
  });

  it('conta quantas apagou, em vez de dizer só "feito"', () => {
    const outcome = runTool({ id: '1', name: 'apagar_tarefas_concluidas', args: {} }, true);
    expect(outcome.message).toContain('3');
  });

  it('uma ferramenta inventada pelo modelo não passa, e fica registada', () => {
    const outcome = runTool({ id: '1', name: 'apagar_disco', args: {} });

    expect(outcome.status).toBe('erro');
    expect(executor.calls).toEqual([]);
    expect(logService.list.some((entry) => entry.message.includes('apagar_disco'))).toBe(true);
  });

  it('sem executor ligado, diz-se em vez de rebentar', () => {
    unregister();

    expect(runTool({ id: '1', name: 'abrir_janela', args: { app: 'emails' } }).status).toBe('erro');
  });
});

describe('procurar_ficheiro e abrir_ficheiro', () => {
  it('lista os resultados com a pasta onde estão', () => {
    const outcome = runTool({
      id: '1',
      name: 'procurar_ficheiro',
      args: { nome: 'orçamento' },
    });

    expect(outcome.status).toBe('ok');
    expect(outcome.message).toContain('orçamento');
    expect(outcome.message).toContain('Documentos');
  });

  it('sem resultados, diz-se em vez de inventar', () => {
    const outcome = runTool({
      id: '1',
      name: 'procurar_ficheiro',
      args: { nome: 'inexistente' },
    });

    expect(outcome.message).toContain('Não encontrei');
  });

  it('abrir_ficheiro pede ao executor para abrir a pasta do resultado', () => {
    const outcome = runTool({ id: '1', name: 'abrir_ficheiro', args: { nome: 'orçamento' } });

    expect(outcome.status).toBe('ok');
    expect(executor.calls).toEqual(['abrir-ficheiro:orçamento']);
  });

  it('sem correspondência, abrir_ficheiro também se explica', () => {
    const outcome = runTool({ id: '1', name: 'abrir_ficheiro', args: { nome: 'inexistente' } });

    expect(outcome.message).toContain('Não encontrei');
  });
});

/**
 * Contexto ("amanhã") resolvido pelo modelo, não por regras escritas à mão
 * (Parte 7 §Contexto). O modelo já recebe a data de hoje por extenso no
 * `system prompt` (`services/assistant/context.ts`); a ferramenta só precisa
 * de um campo para ele devolver o que resolveu, em ISO — nunca "amanhã" a
 * ser interpretado aqui dentro.
 */
describe('criar_tarefa — prazo resolvido pelo modelo', () => {
  it('AAAA-MM-DD válido vira meia-noite local desse dia', () => {
    const outcome = runTool({
      id: '1',
      name: 'criar_tarefa',
      args: { titulo: 'Enviar orçamento', prazo: '2026-08-12' },
    });

    expect(outcome.status).toBe('ok');
    const esperado = new Date('2026-08-12T00:00:00').getTime();
    expect(executor.calls).toEqual([`tarefa:Enviar orçamento:media:${esperado}`]);
    expect(outcome.message).toContain('12/08/2026');
  });

  it('sem prazo, a tarefa fica sem data — não é erro', () => {
    const outcome = runTool({
      id: '1',
      name: 'criar_tarefa',
      args: { titulo: 'Ler o relatório' },
    });

    expect(outcome.status).toBe('ok');
    expect(executor.calls).toEqual(['tarefa:Ler o relatório:media:null']);
  });

  it('um prazo mal formado é ignorado, não inventado', () => {
    const outcome = runTool({
      id: '1',
      name: 'criar_tarefa',
      args: { titulo: 'x', prazo: 'amanhã' },
    });

    expect(outcome.status).toBe('ok');
    expect(executor.calls).toEqual(['tarefa:x:media:null']);
  });
});

describe('confirmação', () => {
  it.each(DESTRUCTIVE_TOOLS)('%s não corre sem alguém confirmar', (name) => {
    const outcome = runTool({ id: '1', name, args: {} });

    expect(outcome.status).toBe('confirmar');
    expect(executor.calls).toEqual([]);
  });

  it('depois de confirmada, corre', () => {
    const outcome = runTool({ id: '1', name: 'apagar_conversas', args: {} }, true);

    expect(outcome.status).toBe('ok');
    expect(executor.calls).toEqual(['apagar-conversas']);
  });

  it('a confirmação vem da interface, nunca dos argumentos do modelo', () => {
    // Mesmo que o modelo mande `confirmed: true` nos argumentos, não conta.
    const outcome = runTool({ id: '1', name: 'apagar_conversas', args: { confirmed: true } });

    expect(outcome.status).toBe('confirmar');
    expect(executor.calls).toEqual([]);
  });

  it('as livres correm à primeira', () => {
    expect(runTool({ id: '1', name: 'mudar_tema', args: { tema: 'oled' } }).status).toBe('ok');
  });
});

describe('auditoria', () => {
  it('tudo o que corre fica registado, com os argumentos', () => {
    runTool({ id: '1', name: 'mudar_tema', args: { tema: 'oled' } });

    const entry = logService.list.find((line) => line.source === 'auditoria');
    expect(entry?.message).toContain('mudar_tema');
    expect(entry?.message).toContain('oled');
  });

  it('o que falha também fica', () => {
    const throwing = { ...executor, setTheme: () => { throw new Error('não deu'); } };
    setToolExecutor(throwing);

    const outcome = runTool({ id: '1', name: 'mudar_tema', args: { tema: 'oled' } });

    expect(outcome.status).toBe('erro');
    expect(
      logService.list.some((line) => line.source === 'auditoria' && line.message.includes('recusado')),
    ).toBe(true);
  });

  it('a descrição é legível por uma pessoa', () => {
    expect(describeCall({ id: '1', name: 'criar_tarefa', args: { titulo: 'comprar pão' } })).toBe(
      'criar_tarefa(titulo=comprar pão)',
    );
  });

  it('uma ferramenta sem argumentos não deixa parênteses estranhos', () => {
    expect(describeCall({ id: '1', name: 'fechar_todas_as_janelas', args: {} })).toBe(
      'fechar_todas_as_janelas()',
    );
  });
});

describe('desligar o executor', () => {
  it('desligar um antigo não apaga o que outro registou entretanto', () => {
    const second = makeExecutor();
    setToolExecutor(second);

    // O primeiro desliga-se depois — não pode levar o segundo à frente.
    unregister();

    runTool({ id: '1', name: 'abrir_janela', args: { app: 'emails' } });
    expect(second.calls).toEqual(['abrir:emails']);
  });
});

describe('cobertura', () => {
  it('toda a ferramenta do catálogo tem execução — nenhuma é uma etiqueta', () => {
    const args: Record<string, Record<string, unknown>> = {
      abrir_janela: { app: 'emails' },
      fechar_janela: { app: 'emails' },
      mudar_tema: { tema: 'oled' },
      mudar_papel_de_parede: { papel: 'liso' },
      mudar_estado_do_sistema: { estado: 'foco' },
      mostrar_widget: { widget: 'clock' },
      esconder_widget: { widget: 'clock' },
      mudar_de_desktop: { desktop: 2 },
      aplicar_layout: { layout: 'jogos' },
      guardar_layout: { nome: 'meu' },
      criar_tarefa: { titulo: 'x' },
      concluir_tarefa: { titulo: 'x' },
      notificar: { titulo: 'a', descricao: 'b' },
      pesquisar: { termo: 'x' },
      procurar_ficheiro: { nome: 'orçamento' },
      abrir_ficheiro: { nome: 'orçamento' },
      controlar_musica: { acao: 'tocar' },
      ler_em_voz_alta: { texto: 'olá' },
      ligar_automacao: { nome: 'x', ligada: true },
      executar_automacao: { nome: 'x' },
    };

    for (const tool of TOOLS) {
      const outcome = runTool({ id: '1', name: tool.name, args: args[tool.name] ?? {} }, true);
      expect(outcome.status, tool.name).toBe('ok');
    }
  });
});

describe('o aviso de que algo espera', () => {
  it('a mensagem de confirmação diz o que se perde, não "tem a certeza?"', () => {
    for (const name of DESTRUCTIVE_TOOLS) {
      const question = getTool(name)?.confirmation?.({}) ?? '';

      // "Tem a certeza?" não informa ninguém. A pergunta tem de dizer o quê.
      expect(question.toLowerCase(), name).not.toContain('tem a certeza');
      expect(question, name).toMatch(/apagar|repor|esquecer/i);
    }
  });

  it('nenhuma ferramenta livre pode ser confundida com uma destrutiva', () => {
    // Uma ferramenta chamada "apagar_" que não peça confirmação seria uma
    // armadilha: o nome promete uma coisa e o comportamento faz outra.
    for (const tool of TOOLS) {
      if (/^(apagar|esquecer|repor)_/.test(tool.name)) {
        expect(tool.risk, tool.name).toBe('perde');
      }
    }
  });
});
