/**
 * Testes para a resolução de referências ambíguas na conversa.
 *
 * Usa `resolveReferencesWith` — a versão injetável que não depende de um
 * provedor real — para simular o comportamento do modelo sem rede nem chaves.
 */

import { describe, expect, it } from 'vitest';

import { resolveReferencesWith } from '@/services/assistant/reference-resolver';
import type { AssistantMessage } from '@/types/assistant';

function msg(author: 'user' | 'assistant', text: string): AssistantMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 6)}`,
    author,
    text,
    createdAt: Date.now(),
    isStreaming: false,
    isFavourite: false,
  };
}

/** Resolvedor simulado: substitui "esse ficheiro" pelo nome do ficheiro mencionado no histórico. */
async function mockResolver(prompt: string, historyText: string): Promise<string> {
  // Simula o que o modelo faria: procura no histórico uma menção a um ficheiro.
  const fileMatch = historyText.match(/(?:ficheiro|documento)\s+(\S+\.\w{3,4})/i);
  if (fileMatch) {
    const fileName = fileMatch[1];
    return prompt.replace(/esse ficheiro/i, `o ficheiro ${fileName}`);
  }

  // Exemplo de "isso" → a última coisa mencionada
  if (/\bisso\b/i.test(prompt)) {
    const lastLine = historyText.split('\n').pop() ?? '';
    const topic = lastLine.replace(/^JARVIS:\s*/i, '').slice(0, 80);
    return prompt.replace(/\bisso\b/gi, topic);
  }

  return prompt;
}

describe('resolveReferencesWith', () => {
  it('resolve "esse ficheiro" quando o histórico menciona um ficheiro', async () => {
    const history = [
      msg('user', 'cria um ficheiro com o orçamento'),
      msg('assistant', 'Criei o ficheiro orcamento-2026.xlsx na pasta Documentos.'),
    ];

    const result = await resolveReferencesWith('abre esse ficheiro', history, mockResolver);

    expect(result).toBe('abre o ficheiro orcamento-2026.xlsx');
  });

  it('não mexe quando não há palavras vagas', async () => {
    const history = [
      msg('user', 'cria um ficheiro'),
      msg('assistant', 'Ficheiro criado.'),
    ];

    const result = await resolveReferencesWith('abre as tarefas', history, mockResolver);

    expect(result).toBe('abre as tarefas');
  });

  it('devolve o original quando não há histórico', async () => {
    const result = await resolveReferencesWith('abre esse ficheiro', [], mockResolver);

    expect(result).toBe('abre esse ficheiro');
  });

  it('devolve o original quando o histórico está vazio (só mensagens vazias)', async () => {
    const history = [msg('user', ''), msg('assistant', '')];

    const result = await resolveReferencesWith('abre esse ficheiro', history, mockResolver);

    expect(result).toBe('abre esse ficheiro');
  });

  it('devolve o original quando o resolvedor falha', async () => {
    const history = [msg('user', 'olá'), msg('assistant', 'Bom dia.')];

    const result = await resolveReferencesWith('abre esse ficheiro', history, async () => {
      throw new Error('rede em baixo');
    });

    // A falha é silenciosa — o pedido original segue.
    expect(result).toBe('abre esse ficheiro');
  });

  it('devolve o original quando o resolvedor devolve o mesmo texto', async () => {
    const history = [msg('user', 'olá'), msg('assistant', 'Bom dia.')];

    const result = await resolveReferencesWith('abre essa janela', history, async () => 'abre essa janela');

    expect(result).toBe('abre essa janela');
  });

  it('resolve "isso" para o último tópico da conversa', async () => {
    const history = [
      msg('user', 'qual é o estado do projeto Agendado?'),
      msg('assistant', 'O projeto Agendado está com 72% de progresso e 4 tarefas por fazer.'),
    ];

    const result = await resolveReferencesWith('mostra-me isso', history, mockResolver);

    expect(result).toContain('72%');
  });

  it('conversa com várias trocas: resolve referência ao que foi dito duas mensagens antes', async () => {
    const history = [
      msg('user', 'preciso de um ficheiro com os dados dos clientes'),
      msg('assistant', 'Criei o ficheiro clientes-2026.csv com os dados.'),
      msg('user', 'obrigado'),
      msg('assistant', 'Sempre às ordens.'),
    ];

    const result = await resolveReferencesWith('envia esse ficheiro por email', history, mockResolver);

    expect(result).toBe('envia o ficheiro clientes-2026.csv por email');
  });
});
