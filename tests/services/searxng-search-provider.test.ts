import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearxngSearchProvider } from '@/services/web-search/providers/searxng-search-provider';

const BASE_URL = 'http://localhost:8888';

function searxngResponse() {
  return new Response(
    JSON.stringify({
      results: [
        { title: 'Resultado um', url: 'https://exemplo.pt/um', content: 'Primeiro resultado.' },
        { title: 'Resultado dois', url: 'https://exemplo.pt/dois', content: 'Segundo resultado.' },
      ],
    }),
    { status: 200 },
  );
}

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve(searxngResponse()));
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

describe('SearxngSearchProvider', () => {
  it('sem endereço, não está configurado', () => {
    expect(new SearxngSearchProvider('').isConfigured()).toBe(false);
    expect(new SearxngSearchProvider('   ').isConfigured()).toBe(false);
  });

  it('com endereço, está configurado — sem chave nenhuma', () => {
    expect(new SearxngSearchProvider(BASE_URL).isConfigured()).toBe(true);
  });

  it('devolve resultados reais — só título, resumo e endereço, nunca HTML', async () => {
    const outcome = await new SearxngSearchProvider(BASE_URL).search('clima');

    expect(outcome.isSimulated).toBe(false);
    expect(outcome.results).toHaveLength(2);

    const [um, dois] = outcome.results;
    expect(um).toEqual({
      title: 'Resultado um',
      snippet: 'Primeiro resultado.',
      url: 'https://exemplo.pt/um',
    });
    expect(dois!.url).toBe('https://exemplo.pt/dois');
    expect(Object.keys(um!).sort()).toEqual(['snippet', 'title', 'url']);
  });

  it('pede sempre format=json, nunca a página HTML de resultados', async () => {
    const captured: string[] = [];
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      captured.push(urlDe(input));
      return Promise.resolve(searxngResponse());
    });

    await new SearxngSearchProvider(BASE_URL).search('o tempo em Lisboa');

    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain('/search');
    expect(captured[0]).toContain('q=o+tempo+em+Lisboa');
    expect(captured[0]).toContain('format=json');
  });

  it('resultados sem endereço são descartados, em vez de entrarem à metade', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              { title: 'Sem endereço', content: 'não deve entrar' },
              { title: 'Com endereço', url: 'https://exemplo.pt/ok', content: 'entra' },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const outcome = await new SearxngSearchProvider(BASE_URL).search('x');

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]!.url).toBe('https://exemplo.pt/ok');
  });

  it('um 403 explica que falta ativar o formato json na instância', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 403 })));

    await expect(new SearxngSearchProvider(BASE_URL).search('x')).rejects.toThrow(
      'search.formats',
    );
  });

  it('outro erro da API propaga-se com o código, em vez de inventar resultados', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 500 })));

    await expect(new SearxngSearchProvider(BASE_URL).search('x')).rejects.toThrow('devolveu 500');
  });

  it('uma falha de rede é traduzida em erro legível, com o endereço da instância', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('rede em baixo')));

    await expect(new SearxngSearchProvider(BASE_URL).search('x')).rejects.toThrow(
      `não consegui ligar ao SearXNG em ${BASE_URL}`,
    );
  });

  it('espera no máximo o tempo definido e explica se demorar demais', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const promise = new SearxngSearchProvider(BASE_URL).search('x');
    const assertion = expect(promise).rejects.toThrow('demorou demasiado');

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
