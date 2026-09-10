import { describe, expect, it } from 'vitest';

import { buildCall, parseLine, tokenize } from '@/services/assistant/console-parser';
import { getTool, TOOLS, validateArgs } from '@/services/assistant/tools';

/**
 * Consola de comandos (Parte 16 §Consola de comandos).
 *
 * O parser é texto puro: entra uma linha, sai um problema ou uma chamada
 * tipada. Testa-se sem montar nada, e sem tocar no `runTool`.
 */

describe('tokenizar', () => {
  it('divide por espaços', () => {
    expect(tokenize('abrir_janela app=emails')).toEqual(['abrir_janela', 'app=emails']);
  });

  it('aspas duplas deixam passar o espaço', () => {
    expect(tokenize('criar_tarefa titulo="comprar leite e pão"')).toEqual([
      'criar_tarefa',
      'titulo=comprar leite e pão',
    ]);
  });

  it('aspas simples fazem o mesmo', () => {
    expect(tokenize("notificar titulo='Olá mundo'")).toEqual(['notificar', "titulo=Olá mundo"]);
  });

  it('espaços a mais não geram tokens vazios', () => {
    expect(tokenize('  abrir_janela    app=emails  ')).toEqual(['abrir_janela', 'app=emails']);
  });

  it('uma linha vazia não dá tokens', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('interpretar a linha', () => {
  it('só o nome, sem argumentos', () => {
    const result = parseLine('fechar_todas_as_janelas');
    expect(result).toEqual({ ok: true, line: { name: 'fechar_todas_as_janelas', args: {} } });
  });

  it('nome e argumentos', () => {
    const result = parseLine('abrir_janela app=emails');
    expect(result).toEqual({ ok: true, line: { name: 'abrir_janela', args: { app: 'emails' } } });
  });

  it('vários argumentos, um com espaços entre aspas', () => {
    const result = parseLine('criar_tarefa titulo="comprar pão" prioridade=alta');
    expect(result.ok && result.line.args).toEqual({ titulo: 'comprar pão', prioridade: 'alta' });
  });

  it('linha vazia é um problema, não uma chamada', () => {
    const result = parseLine('   ');
    expect(result.ok).toBe(false);
  });

  it('um token sem "=" é um argumento inválido', () => {
    const result = parseLine('abrir_janela emails');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toContain('emails');
  });

  it('um token que começa por "=" também é inválido', () => {
    // eq <= 0 rejeita tanto a ausência de "=" como um "=" na primeira posição,
    // que não teria chave nenhuma antes dele.
    const result = parseLine('abrir_janela =emails');
    expect(result.ok).toBe(false);
  });
});

describe('construir a chamada', () => {
  it('uma ferramenta desconhecida é recusada antes de tudo o resto', () => {
    const parsed = parseLine('apagar_tudo');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.problem).toContain('apagar_tudo');
  });

  it('um argumento que a ferramenta não tem é recusado, e não ignorado em silêncio', () => {
    const parsed = parseLine('fechar_todas_as_janelas confirmar=true');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.problem).toContain('confirmar');
  });

  it('um número que não é número é recusado com a linha exata', () => {
    const parsed = parseLine('mudar_de_desktop desktop=dois');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.problem).toContain('desktop');
  });

  it('um número válido converte-se de facto em número', () => {
    const parsed = parseLine('mudar_de_desktop desktop=2');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(true);
    expect(built.ok && built.call.args['desktop']).toBe(2);
    expect(built.ok && typeof built.call.args['desktop']).toBe('number');
  });

  it('"true"/"false" convertem-se em booleano', () => {
    const parsed = parseLine('ligar_automacao nome=rotina ligada=true');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(true);
    expect(built.ok && built.call.args['ligada']).toBe(true);
  });

  it('um booleano escrito de outra forma é recusado', () => {
    const parsed = parseLine('ligar_automacao nome=rotina ligada=sim');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.problem).toContain('ligada');
  });

  it('um obrigatório em falta usa a mesma mensagem do validateArgs', () => {
    const parsed = parseLine('abrir_janela');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const tool = getTool('abrir_janela');
    if (!tool) throw new Error('ferramenta não encontrada');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.problem).toBe(validateArgs(tool, {}));
  });

  it('uma opção fora da lista é recusada', () => {
    const parsed = parseLine('abrir_janela app=inexistente');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('id-1', parsed.line);
    expect(built.ok).toBe(false);
  });

  it('o id que se passa é o id da chamada', () => {
    const parsed = parseLine('fechar_todas_as_janelas');
    if (!parsed.ok) throw new Error('não devia falhar aqui');

    const built = buildCall('meu-id', parsed.line);
    expect(built.ok && built.call.id).toBe('meu-id');
  });
});

describe('cobertura do catálogo', () => {
  it('toda a ferramenta livre, sem argumentos, constrói-se só com o nome', () => {
    const semArgumentos = TOOLS.filter(
      (tool) => tool.risk === 'livre' && tool.parameters.length === 0,
    );

    expect(semArgumentos.length).toBeGreaterThan(0);

    for (const tool of semArgumentos) {
      const parsed = parseLine(tool.name);
      expect(parsed.ok, tool.name).toBe(true);
      if (!parsed.ok) continue;

      const built = buildCall('id', parsed.line);
      expect(built.ok, tool.name).toBe(true);
    }
  });
});
