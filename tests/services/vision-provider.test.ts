import { describe, expect, it, vi } from 'vitest';

import { ClaudeVisionProvider } from '@/services/vision/claude-vision-provider';
import { OllamaVisionProvider } from '@/services/vision/ollama-vision-provider';

/**
 * Visão de ecrã (Fase 3.5).
 *
 * O contrato é mais simples que o dos provedores de texto: uma imagem (PNG em
 * base64) entra, uma descrição sai, de uma vez — sem streaming nem ferramentas.
 * O que se testa aqui é o que importa para a privacidade: o Ollama fala com
 * `localhost` (o print não sai da máquina) e o Claude manda um bloco de imagem
 * com o base64 no pedido. As falhas continuam tipadas (`AiFailure`), para a
 * ferramenta `ver_ecra` poder traduzi-las em frases.
 */

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function fakeFetch(response: {
  readonly ok?: boolean;
  readonly status?: number;
  readonly json?: () => Promise<unknown>;
}): typeof fetch {
  return vi.fn(async () => ({ ok: true, status: 200, ...response }) as unknown as Response);
}

describe('OllamaVisionProvider', () => {
  it('está configurado com um nome de modelo, sem chave nenhuma', () => {
    expect(new OllamaVisionProvider('llava').isConfigured()).toBe(true);
    expect(new OllamaVisionProvider('').isConfigured()).toBe(false);
  });

  it('fala com o /api/chat local e devolve a descrição', async () => {
    const fetchImpl = fakeFetch({
      json: async () => ({ message: { content: 'Um botão "OK" em (300, 400).' } }),
    });
    const provider = new OllamaVisionProvider('llava', 'http://localhost:11434', fetchImpl);

    const result = await provider.describe(PNG);

    expect(result).toBe('Um botão "OK" em (300, 400).');
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/chat');
    const sent = JSON.parse(init.body as string) as { messages: { images?: string[] }[] };
    expect(sent.messages[0]?.images).toEqual([PNG]);
  });

  it('um modelo de visão em falta (404) diz "modelo", não um servidor avariado', async () => {
    const fetchImpl = fakeFetch({
      ok: false,
      status: 404,
      json: async () => ({ error: "model 'llava' not found" }),
    });
    const provider = new OllamaVisionProvider('llava', 'http://localhost:11434', fetchImpl);

    await expect(provider.describe(PNG)).rejects.toMatchObject({ kind: 'modelo' });
  });

  it('sem o Ollama a correr, o erro de rede vira falha de rede, não um crash', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const provider = new OllamaVisionProvider('llava', 'http://localhost:11434', fetchImpl);

    await expect(provider.describe(PNG)).rejects.toMatchObject({ kind: 'rede' });
  });

  it('respondeu mas sem conteúdo — falha vazia', async () => {
    const fetchImpl = fakeFetch({ json: async () => ({ message: { content: '' } }) });
    const provider = new OllamaVisionProvider('llava', 'http://localhost:11434', fetchImpl);

    await expect(provider.describe(PNG)).rejects.toMatchObject({ kind: 'vazio' });
  });
});

describe('ClaudeVisionProvider', () => {
  it('está configurado com uma chave', () => {
    expect(new ClaudeVisionProvider('sk-abc').isConfigured()).toBe(true);
    expect(new ClaudeVisionProvider('').isConfigured()).toBe(false);
  });

  it('manda um bloco de imagem e devolve a descrição', async () => {
    const fetchImpl = fakeFetch({
      json: async () => ({ content: [{ type: 'text', text: 'Uma janela do Bloco de Notas.' }] }),
    });
    const provider = new ClaudeVisionProvider('sk-abc', 'claude-sonnet-5', fetchImpl);

    const result = await provider.describe(PNG);

    expect(result).toBe('Uma janela do Bloco de Notas.');
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const sent = JSON.parse(init.body as string) as {
      messages: { content: { type?: string; source?: { data?: string } }[] }[];
    };
    const content = sent.messages[0]?.content ?? [];
    const image = content.find((block) => block.type === 'image');
    expect(image?.source?.data).toBe(PNG);
  });

  it('junta vários blocos de texto numa descrição só', async () => {
    const fetchImpl = fakeFetch({
      json: async () => ({ content: [{ type: 'text', text: 'A. ' }, { type: 'text', text: 'B.' }] }),
    });
    const provider = new ClaudeVisionProvider('sk-abc', 'claude-sonnet-5', fetchImpl);

    expect(await provider.describe(PNG)).toBe('A. B.');
  });

  it('sem chave válida (401), falha como chave', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 401, json: async () => ({}) });
    const provider = new ClaudeVisionProvider('sk-abc', 'claude-sonnet-5', fetchImpl);

    await expect(provider.describe(PNG)).rejects.toMatchObject({ kind: 'chave' });
  });
});
