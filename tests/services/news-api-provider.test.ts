import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  categorize,
  NewsApiProvider,
} from '@/services/news/providers/news-api-provider';

const KEY = '0123456789abcdef0123456789abcdef';

function newsApiResponse() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      totalResults: 2,
      articles: [
        {
          source: { id: null, name: 'Tech Diário' },
          title: 'Novo chip acelera a inteligência artificial',
          description: 'Investigadores anunciam um processador mais rápido.',
          url: 'https://exemplo.pt/chip',
          publishedAt: '2026-08-13T10:00:00Z',
        },
        {
          source: { id: null, name: 'Desporto Total' },
          title: 'Benfica vence o clássico',
          description: 'Golo nos descontos decide o jogo.',
          url: 'https://exemplo.pt/benfica',
          publishedAt: '2026-08-13T09:00:00Z',
        },
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
  localStorage.clear();
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = urlDe(input);
    if (url.includes('/v2/top-headlines')) return Promise.resolve(newsApiResponse());
    return Promise.reject(new Error(`URL inesperada: ${url}`));
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('categorize', () => {
  it.each([
    ['tecnologia', 'novo software com inteligência artificial'],
    ['ciencia', 'investigadores publicam um estudo sobre saúde'],
    ['negocios', 'a bolsa subiu e a economia acelera'],
    ['desporto', 'futebol: o benfica venceu o jogo'],
    ['mundo', 'cimeira reúne delegações estrangeiras'],
  ])('%s ← "%s"', (category, texto) => {
    expect(categorize(texto)).toBe(category);
  });
});

describe('NewsApiProvider', () => {
  it('sem chave, não está configurado', () => {
    expect(new NewsApiProvider('').isConfigured()).toBe(false);
    expect(new NewsApiProvider('   ').isConfigured()).toBe(false);
  });

  it('com chave, está configurado', () => {
    expect(new NewsApiProvider(KEY).isConfigured()).toBe(true);
  });

  it('devolve artigos reais, da fonte para os campos da interface', async () => {
    const feed = await new NewsApiProvider(KEY, 'pt').fetch();

    expect(feed.isSimulated).toBe(false);
    expect(feed.articles).toHaveLength(2);

    const [chip, benfica] = feed.articles;
    expect(chip!.title).toBe('Novo chip acelera a inteligência artificial');
    expect(chip!.source).toBe('Tech Diário');
    expect(chip!.category).toBe('tecnologia');
    expect(chip!.publishedAt).toBe(Date.parse('2026-08-13T10:00:00Z'));
    expect(new URL(chip!.url).protocol).toBe('https:');
    expect(benfica!.category).toBe('desporto');
  });

  it('pede o topo do país escolhido com a chave na query', async () => {
    const urls: string[] = [];
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      urls.push(urlDe(input));
      return Promise.resolve(newsApiResponse());
    });

    await new NewsApiProvider(KEY, 'br').fetch();

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/v2/top-headlines');
    expect(urls[0]).toContain('country=br');
    expect(urls[0]).toContain(`apiKey=${KEY}`);
  });

  it('marcar como lida persiste entre leituras e entre instâncias', async () => {
    const primeiro = new NewsApiProvider(KEY);
    await primeiro.markRead('https://exemplo.pt/chip', true);
    await primeiro.toggleFavorite('https://exemplo.pt/chip');

    // Uma instância nova simula fechar e voltar a abrir: as marcas vêm do
    // storage, não da memória do provedor anterior.
    const segundo = new NewsApiProvider(KEY);
    const feed = await segundo.fetch();
    const chip = feed.articles.find((a) => a.url === 'https://exemplo.pt/chip');

    expect(chip!.isRead).toBe(true);
    expect(chip!.isFavorite).toBe(true);
  });

  it('desmarcar como lida limpa a marca', async () => {
    const provider = new NewsApiProvider(KEY);
    await provider.markRead('https://exemplo.pt/benfica', true);
    await provider.markRead('https://exemplo.pt/benfica', false);

    const feed = await provider.fetch();
    expect(feed.articles.find((a) => a.url === 'https://exemplo.pt/benfica')!.isRead).toBe(false);
  });

  it('um erro da NewsAPI propaga-se, em vez de inventar notícias', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'error', code: 'apiKeyInvalid' }), { status: 401 }),
      ),
    );

    await expect(new NewsApiProvider(KEY).fetch()).rejects.toThrow();
  });
});
