import { beforeEach, describe, expect, it } from 'vitest';

import { extractPreference, MemoryService } from '@/services/assistant/memory-service';
import { MEMORY_PROMPT_LIMIT } from '@/types/assistant';

let memory: MemoryService;

beforeEach(() => {
  localStorage.clear();
  memory = new MemoryService();
});

describe('ler preferências ditas por palavras', () => {
  it.each([
    ['Trata-me por Anderson', 'nome', 'Anderson'],
    ['chama-me Quadri', 'nome', 'Quadri'],
    ['O meu nome é Ana Maria', 'nome', 'Ana Maria'],
    ['Moro no Porto', 'cidade', 'Porto'],
    ['vivo em Lisboa.', 'cidade', 'Lisboa'],
    ['Trabalho como programador', 'trabalho', 'programador'],
    ['Prefiro o tema escuro', 'preferência', 'o tema escuro'],
  ])('%s', (text, key, value) => {
    expect(extractPreference(text)).toEqual({ key, value });
  });

  it('uma frase qualquer não é uma preferência', () => {
    expect(extractPreference('Que horas são?')).toBeNull();
  });

  it('não guarda um valor vazio', () => {
    expect(extractPreference('trata-me por ')).toBeNull();
  });

  it('não guarda uma frase inteira como se fosse um nome', () => {
    const long = `moro em ${'x'.repeat(80)}`;
    expect(extractPreference(long)).toBeNull();
  });
});

describe('memória', () => {
  it('guarda o pedido e diz o que aprendeu', () => {
    expect(memory.observe('Trata-me por Anderson')).toBe('nome');
    expect(memory.current.preferences['nome']).toBe('Anderson');
    expect(memory.current.recentPrompts[0]).toBe('Trata-me por Anderson');
  });

  it('um pedido sem preferência nenhuma não inventa uma', () => {
    expect(memory.observe('Que horas são?')).toBeNull();
    expect(memory.current.preferences).toEqual({});
  });

  it('repetir o mesmo pedido não o duplica, mas põe-no no topo', () => {
    memory.observe('abre os emails');
    memory.observe('que horas são');
    memory.observe('Abre os emails');

    expect(memory.current.recentPrompts).toHaveLength(2);
    expect(memory.current.recentPrompts[0]).toBe('Abre os emails');
  });

  it('não cresce sem limite', () => {
    for (let index = 0; index < MEMORY_PROMPT_LIMIT + 10; index += 1) {
      memory.observe(`pedido ${index}`);
    }

    expect(memory.current.recentPrompts).toHaveLength(MEMORY_PROMPT_LIMIT);
  });

  it('esquecer apaga só o que se pediu', () => {
    memory.observe('trata-me por Anderson');
    memory.observe('moro no Porto');

    memory.forget('nome');

    expect(memory.current.preferences['nome']).toBeUndefined();
    expect(memory.current.preferences['cidade']).toBe('Porto');
  });

  it('esquecer tudo esvazia mesmo tudo', () => {
    memory.observe('trata-me por Anderson');
    memory.clear();

    expect(memory.current.preferences).toEqual({});
    expect(memory.current.recentPrompts).toEqual([]);
  });

  it('avisa quem estiver a ouvir', () => {
    let calls = 0;
    memory.subscribe(() => {
      calls += 1;
    });

    memory.observe('olá');
    expect(calls).toBe(1);
  });

  it('sobrevive a recarregar', async () => {
    memory.observe('trata-me por Anderson');
    await memory.persist();

    const other = new MemoryService();
    await other.hydrate();

    expect(other.current.preferences['nome']).toBe('Anderson');
  });

  it('sem nada gravado começa vazia, não indefinida', async () => {
    await memory.hydrate();

    expect(memory.current.preferences).toEqual({});
    expect(memory.current.recentPrompts).toEqual([]);
  });
});
