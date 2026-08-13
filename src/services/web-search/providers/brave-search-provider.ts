import type { SearchOutcome, SearchResult } from '@/types/web-search';
import type { WebSearchProvider } from './web-search-provider';

/**
 * Provedor real de pesquisa web — Brave Search API.
 *
 * Escolheu-se o Brave Search em vez do Bing pela mesma razão do Open-Meteo em
 * vez do OpenWeatherMap: simplicidade de quem põe a funcionar. O Bing Web
 * Search exige uma subscrição do Azure com várias camadas (recurso, chave,
 * endpoint) antes do primeiro pedido; o Brave Search tem um plano gratuito
 * (2000 pesquisas por mês) e respostas JSON limpas — `web.results` com
 * `title`, `description` e `url`, exatamente os três campos que a ferramenta
 * devolve. O custo é o mesmo dos dois: uma chave, que fica no cofre do
 * sistema. Não se liga a nenhuma página dos resultados — só ao endpoint de
 * pesquisa, e nunca se segue uma `url` devolvida.
 *
 * A chave viaja no cabeçalho `X-Subscription-Token`, nunca na query (que
 * ficaria em registos de acesso). O endpoint é `https://api.search.brave.com`,
 * que o CSP da aplicação autoriza (ver `tauri.conf.json` §`connect-src`).
 */

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

/** Quantos resultados se pedem — o bastante para uma resposta útil, sem pesar. */
const RESULT_COUNT = 8;

/** Quanto tempo se espera antes de desistir. */
const TIMEOUT_MS = 10_000;

/** Resposta crua da Brave Search — só os campos que se usam. */
interface BraveWebResult {
  readonly title?: string;
  readonly url?: string;
  readonly description?: string;
}

interface BraveWebSection {
  readonly results?: readonly BraveWebResult[];
}

interface BraveSearchResponse {
  readonly web?: BraveWebSection;
}

export class BraveSearchProvider implements WebSearchProvider {
  readonly id = 'brave';
  readonly name = 'Brave Search';

  constructor(private readonly apiKey: string) {}

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
    const url = new URL(BRAVE_SEARCH_URL);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('count', String(RESULT_COUNT));

    // O relógio e o cancelamento de quem chama têm de valer os dois — uma
    // pesquisa pendurada numa rede má não pode deixar o assistente à espera.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.apiKey.trim(),
        },
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error('a pesquisa demorou demasiado e foi cancelada');
      }
      throw new Error('não consegui ligar à Brave Search');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (!response.ok) {
      throw new Error(`a Brave Search devolveu ${response.status}`);
    }

    const body = (await response.json()) as BraveSearchResponse;
    const results: readonly SearchResult[] = (body.web?.results ?? [])
      .map((result) => ({
        title: result.title?.trim() || '(sem título)',
        snippet: result.description?.trim() ?? '',
        url: result.url ?? '',
      }))
      .filter((result) => result.url.length > 0);

    return { isSimulated: false, results };
  }
}
