import { describe, expect, it } from 'vitest';

import { isPluginToCoreMessage } from '@/plugins/runtime/protocol';

/**
 * `isPluginToCoreMessage` é a última barreira antes de o Core despachar uma
 * mensagem vinda de um `<iframe sandbox>` — um plugin só fala por
 * `postMessage`, e é aqui que se confirma a forma de cada pedido. Se um campo
 * obrigatório passa aqui em falta, o tipo `PluginToCoreMessage` passa a mentir
 * e o despacho lê `undefined` onde jurou haver uma string.
 */

describe('isPluginToCoreMessage — a fronteira da forma', () => {
  it('aceita uma escrita de ficheiro bem formada', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.fs.write',
        requestId: 'r-1',
        payload: { caminho: 'nota.txt', conteudo: 'olá' },
      }),
    ).toBe(true);
  });

  it('recusa uma escrita sem `conteudo` — o campo é obrigatório', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.fs.write',
        requestId: 'r-2',
        payload: { caminho: 'nota.txt' },
      }),
    ).toBe(false);
  });

  it('recusa uma escrita com `conteudo` que não é texto', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.fs.write',
        requestId: 'r-3',
        payload: { caminho: 'nota.txt', conteudo: 42 },
      }),
    ).toBe(false);
  });

  it('aceita uma leitura — só precisa do caminho', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.fs.read',
        requestId: 'r-4',
        payload: { caminho: 'nota.txt' },
      }),
    ).toBe(true);
  });

  it('recusa storage.set com chave vazia — a chave é o que isola cada plugin', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.storage.set',
        requestId: 'r-5',
        payload: { chave: '', valor: 1 },
      }),
    ).toBe(false);
  });

  it('recusa setting.register com chave vazia', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.setting.register',
        requestId: 'r-6',
        payload: { chave: '', rotulo: 'X', tipo: 'boolean', valorOmissao: true },
      }),
    ).toBe(false);
  });

  it('aceita core.voice.speak com texto', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.voice.speak',
        requestId: 'r-7',
        payload: { texto: 'Olá' },
      }),
    ).toBe(true);
  });

  it('recusa core.voice.speak sem texto — falar em vazio é ruído', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.voice.speak',
        requestId: 'r-8',
        payload: { texto: '' },
      }),
    ).toBe(false);
  });

  it('aceita core.memory.read — não precisa de payload', () => {
    expect(
      isPluginToCoreMessage({
        type: 'core.memory.read',
        requestId: 'r-9',
        payload: {},
      }),
    ).toBe(true);
  });
});
