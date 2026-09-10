import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BraveSearchProvider } from '@/services/web-search/providers/brave-search-provider';

const KEY = '0123456789abcdef0123456789abcdef';

function braveResponse() {
  return new Response(
    JSON.stringify({
      web: {
        results: [
          {
            title: 'Resultado um',
            url: 'https://exemplo.pt/um',
            description: 'Primeiro resultado.',
          },
          {
            title: 'Resultado dois',
            url: 'https://exemplo.pt/dois',
            description: 'Segundo resultado.',
          },
        ],
      },
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
  global.fetch = vi.fn(() => Promise.resolve(braveResponse()));
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

describe('BraveSearchProvider', () => {
  it('sem chave, não está configurado', () => {
    expect(new BraveSearchProvider('').isConfigured()).toBe(false);
    expect(new BraveSearchProvider('   ').isConfigured()).toBe(false);
  });

  it('com chave, está configurado', () => {
    expect(new BraveSearchProvider(KEY).isConfigured()).toBe(true);
  });

  it('devolve resultados reais — só título, resumo e endereço, nunca HTML', async () => {
    const outcome = await new BraveSearchProvider(KEY).search('clima');

    expect(outcome.isSimulated).toBe(false);
    expect(outcome.results).toHaveLength(2);

    const [um, dois] = outcome.results;
    expect(um).toEqual({
      title: 'Resultado um',
      snippet: 'Primeiro resultado.',
      url: 'https://exemplo.pt/um',
    });
    expect(dois!.url).toBe('https://exemplo.pt/dois');
    // Nenhum resultado carrega mais do que os três campos — nunca o conteúdo
    // da página nem o HTML da lista de resultados.
    expect(Object.keys(um!).sort()).toEqual(['snippet', 'title', 'url']);
  });

  it('manda o termo e a chave no cabeçalho — nunca na query', async () => {
    const captured: { url: string; token: string | null }[] = [];
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({
        url: urlDe(input),
        token: new Headers(init?.headers).get('X-Subscription-Token'),
      });
      return Promise.resolve(braveResponse());
    });

    await new BraveSearchProvider(KEY).search('o tempo em Lisboa');

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toContain('/res/v1/web/search');
    expect(captured[0]!.url).toContain('q=o+tempo+em+Lisboa');
    expect(captured[0]!.url).not.toContain(KEY);
    expect(captured[0]!.token).toBe(KEY);
  });

  it('resultados sem endereço são descartados, em vez de entrarem à metade', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            web: {
              results: [
                { title: 'Sem endereço', description: 'não deve entrar' },
                { title: 'Com endereço', url: 'https://exemplo.pt/ok', description: 'entra' },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const outcome = await new BraveSearchProvider(KEY).search('x');

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]!.url).toBe('https://exemplo.pt/ok');
  });

  it('um erro da API propaga-se, em vez de inventar resultados', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 401 })),
    );

    await expect(new BraveSearchProvider(KEY).search('x')).rejects.toThrow('devolveu 401');
  });

  it('uma falha de rede é traduzida em erro legível', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('rede em baixo')));

    await expect(new BraveSearchProvider(KEY).search('x')).rejects.toThrow(
      'não consegui ligar à Brave Search',
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

    const promise = new BraveSearchProvider(KEY).search('x');
    const assertion = expect(promise).rejects.toThrow('demorou demasiado');

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
