import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import type { NewsArticle, NewsCategory, NewsFeed } from '@/types/news';
import type { NewsProvider } from './news-provider';

/**
 * Provedor real de notícias — NewsAPI.org.
 *
 * A NewsAPI precisa de chave (contrariamente ao Open-Meteo), por isso esta
 * implementação segue o molde da DeepSeek: a chave vive no cofre do sistema e
 * nunca toca no storage normal. Um pedido por leitura — `top-headlines` com o
 * país escolhido — devolvido como `NewsFeed`, com `isSimulated: false`.
 *
 * **Categorias.** A NewsAPI só devolve a categoria quando se pede uma em
 * concreto; o topo geral não classifica. Para não gastar cinco pedidos por
 * leitura (o plano gratuito é de 100/dia), pede-se o topo geral e adivinha-se
 * a categoria por palavras no título, no resumo e na fonte — melhor esforço,
 * com "mundo" por omissão. É uma heurística, não uma classificação editorial.
 *
 * **Marcas de leitura e favoritos.** Os serviços de notícias não sincronizam
 * estas marcas — são do leitor, não do artigo. Guardam-se **localmente**, no
 * storage, chaveadas pelo endereço do artigo (o único identificador estável
 * que a NewsAPI dá). Sobrevivem a fechar e voltar a abrir, mas não passam para
 * outro dispositivo — e está documentado por escrito aqui, em vez de se fingir
 * que existe uma sincronização que não existe.
 */

const NEWS_API_URL = 'https://newsapi.org/v2/top-headlines';

/** Resposta crua da NewsAPI — só os campos que se usam. */
interface NewsApiArticle {
  readonly source: { readonly id: string | null; readonly name: string | null };
  readonly title: string | null;
  readonly description: string | null;
  readonly url: string;
  readonly publishedAt: string | null;
}

interface NewsApiResponse {
  readonly status: string;
  readonly code?: string;
  readonly message?: string;
  readonly articles?: readonly NewsApiArticle[];
}

/** Formato das marcas guardadas no storage. */
interface NewsMarks {
  readonly read: readonly string[];
  readonly favorites: readonly string[];
}

/** Palavras que denunciam cada categoria, na língua do país pedido. */
const CATEGORY_HINTS: readonly [NewsCategory, readonly string[]][] = [
  ['tecnologia', ['tech', 'tecnologia', 'software', 'aplicação', 'app', 'inteligência artificial', 'chip', 'internet', 'digital', 'robot', 'startup']],
  ['ciencia', ['ciência', 'nasa', 'espaço', 'estudo', 'investigador', 'cientista', 'saúde', 'medicina', 'vacina', 'laboratório']],
  ['negocios', ['negócio', 'economia', 'mercado', 'empresa', 'bolsa', 'investimento', 'banca', 'finanças', 'euro', 'inflação', 'banco']],
  ['desporto', ['futebol', 'benfica', 'porto', 'sporting', 'desporto', 'liga', 'jogo', 'atleta', 'treinador', 'golo']],
];

/** Adivinha a categoria a partir do texto, com "mundo" por omissão. */
export function categorize(texto: string): NewsCategory {
  const alvo = texto.toLowerCase();
  for (const [category, palavras] of CATEGORY_HINTS) {
    if (palavras.some((palavra) => alvo.includes(palavra))) return category;
  }
  return 'mundo';
}

export class NewsApiProvider implements NewsProvider {
  readonly id = 'newsapi';
  readonly name = 'NewsAPI';

  /** Marcas locais — veja a nota no cabeçalho do ficheiro. */
  private readonly read = new Set<string>();
  private readonly favorites = new Set<string>();
  private marksLoaded: Promise<void> | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly country = 'pt',
  ) {}

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async fetch(signal?: AbortSignal): Promise<NewsFeed> {
    await this.loadMarks();

    const url = new URL(NEWS_API_URL);
    url.searchParams.set('country', this.country || 'pt');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('apiKey', this.apiKey.trim());

    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) {
      throw new Error(`a NewsAPI devolveu ${response.status}`);
    }

    const body = (await response.json()) as NewsApiResponse;
    if (body.status !== 'ok') {
      throw new Error(`a NewsAPI recusou o pedido: ${body.message ?? body.code ?? body.status}`);
    }

    const now = Date.now();
    const articles: readonly NewsArticle[] = (body.articles ?? []).map((article) => ({
      id: article.url,
      title: article.title?.trim() || '(sem título)',
      summary: article.description?.trim() ?? '',
      source: article.source.name?.trim() || 'Desconhecida',
      category: categorize(`${article.title ?? ''} ${article.description ?? ''} ${article.source.name ?? ''}`),
      publishedAt: article.publishedAt ? Date.parse(article.publishedAt) : now,
      url: article.url,
      isRead: this.read.has(article.url),
      isFavorite: this.favorites.has(article.url),
    }));

    return { articles, fetchedAt: now, isSimulated: false };
  }

  async markRead(articleId: string, isRead: boolean): Promise<void> {
    await this.loadMarks();
    if (isRead) this.read.add(articleId);
    else this.read.delete(articleId);
    await this.persistMarks();
  }

  async toggleFavorite(articleId: string): Promise<void> {
    await this.loadMarks();
    if (this.favorites.has(articleId)) this.favorites.delete(articleId);
    else this.favorites.add(articleId);
    await this.persistMarks();
  }

  /** Lê as marcas do storage uma só vez, à primeira utilização. */
  private loadMarks(): Promise<void> {
    this.marksLoaded ??= storageService
      .get<NewsMarks>(STORAGE_KEYS.newsMarks, { read: [], favorites: [] })
      .then((saved) => {
        for (const id of saved.read) this.read.add(id);
        for (const id of saved.favorites) this.favorites.add(id);
      });
    return this.marksLoaded;
  }

  private async persistMarks(): Promise<void> {
    const marks: NewsMarks = {
      read: [...this.read],
      favorites: [...this.favorites],
    };
    await storageService.set(STORAGE_KEYS.newsMarks, marks);
  }
}
