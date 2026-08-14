import { describe, expect, it } from 'vitest';

import { extractSentences } from '@/services/voice/sentence-segmenter';

describe('extractSentences', () => {
  it('corta uma frase completa e não deixa resto', () => {
    const { sentences, remainder } = extractSentences('Bom dia.');
    expect(sentences).toEqual(['Bom dia.']);
    expect(remainder).toBe('');
  });

  it('corta várias frases do mesmo buffer', () => {
    const { sentences, remainder } = extractSentences('Olá! Como estás? Tudo bem.');
    expect(sentences).toEqual(['Olá!', 'Como estás?', 'Tudo bem.']);
    expect(remainder).toBe('');
  });

  it('uma frase incompleta no fim fica por fechar, para juntar ao próximo bocado', () => {
    const { sentences, remainder } = extractSentences('Isto está a chegar aos boc');
    expect(sentences).toEqual([]);
    expect(remainder).toBe('Isto está a chegar aos boc');
  });

  it('junta o resto do bocado anterior ao seguinte antes de voltar a cortar', () => {
    const primeiro = extractSentences('Isto está a chegar aos boc');
    const segundo = extractSentences(`${primeiro.remainder}ados. Próxima frase.`);
    expect(segundo.sentences).toEqual(['Isto está a chegar aos bocados.', 'Próxima frase.']);
    expect(segundo.remainder).toBe('');
  });

  it('reticências fecham a frase como um só fim, não três', () => {
    const { sentences, remainder } = extractSentences('Espera... Já vou.');
    expect(sentences).toEqual(['Espera...', 'Já vou.']);
    expect(remainder).toBe('');
  });

  it('abreviaturas comuns não partem a frase a meio', () => {
    const { sentences, remainder } = extractSentences('O Sr. Silva chegou. Trouxe o n.º 5.');
    expect(sentences).toEqual(['O Sr. Silva chegou.', 'Trouxe o n.º 5.']);
    expect(remainder).toBe('');
  });

  it('etc. no meio da frase não a corta', () => {
    const { sentences, remainder } = extractSentences('Café, chá, etc. Mais nada.');
    expect(sentences).toEqual(['Café, chá, etc. Mais nada.']);
    expect(remainder).toBe('');
  });

  it('buffer vazio não dá frases nem rebenta', () => {
    expect(extractSentences('')).toEqual({ sentences: [], remainder: '' });
  });

  it('só espaço em branco fica todo no resto', () => {
    expect(extractSentences('   ')).toEqual({ sentences: [], remainder: '   ' });
  });

  it('a meio do stream, pontuação mesmo no fim do bocado fica por fechar — não parte "3.14" a meio', () => {
    const primeiro = extractSentences('O valor é 3.', false);
    expect(primeiro.sentences).toEqual([]);
    expect(primeiro.remainder).toBe('O valor é 3.');

    const segundo = extractSentences(`${primeiro.remainder}14 metros.`, false);
    expect(segundo.sentences).toEqual([]);
    expect(segundo.remainder).toBe('O valor é 3.14 metros.');

    const fim = extractSentences(segundo.remainder, true);
    expect(fim.sentences).toEqual(['O valor é 3.14 metros.']);
    expect(fim.remainder).toBe('');
  });

  it('a meio do stream, uma frase fechada a meio do bocado sai logo, e a última fica por fechar', () => {
    const { sentences, remainder } = extractSentences('Olá. Tudo bem.', false);
    expect(sentences).toEqual(['Olá.']);
    expect(remainder.trim()).toBe('Tudo bem.');
  });

  it('com final (texto completo), o fim do buffer continua a fechar a frase', () => {
    expect(extractSentences('O valor é 3.', true).sentences).toEqual(['O valor é 3.']);
  });
});
