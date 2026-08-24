import type { SearchOutcome, SearchResult } from '@/types/web-search';
import type { WebSearchProvider } from './web-search-provider';

/**
 * Provedor real de pesquisa web — SearXNG, uma instância local (item 28,
 * 20/08/2026).
 *
 * **A honestidade primeiro, porque é o que a interface tem de dizer**:
 * pesquisar na web exige a internet — o termo da pesquisa sai desta
 * máquina, sempre, para os motores que o SearXNG consulta. O que muda em
 * relação à Brave Search não é "nada sai" — é que não há **chave, conta,
 * nem intermediário comercial** a ver a pergunta e a identidade de quem a
 * fez: a instância local recebe o termo, pergunta a vários motores públicos
 * e junta os resultados, sem que a Brave (ou quem for) saiba quem perguntou.
 *
 * Sem chave nenhuma — a "chave" aqui é só o endereço da instância, e a
 * `isConfigured()` confirma que há um endereço, não que a instância responde
 * (isso só se sabe ao pesquisar a sério).
 *
 * **Nunca passa pelo `fetch_page_text` do Rust** (que tem um bloqueio de
 * SSRF contra `localhost` e redes privadas, de propósito — corrigido em
 * 13/08/2026): mandar-lhe uma instância local seria recusado, e desligar o
 * bloqueio para isto funcionar reabriria a falha que ele existe para
 * fechar. Por isso, tal como a Brave, vai pelo `fetch` da própria interface.
 */

/** Quantos resultados se pedem — o bastante para uma resposta útil, sem pesar. */
const RESULT_COUNT = 8;

/** Quanto tempo se espera antes de desistir. */
const TIMEOUT_MS = 10_000;

/**
 * Resposta crua do `GET /search?format=json` do SearXNG — só os campos que
 * se usam. `content` é o nome real do campo de resumo na API do SearXNG
 * (não `description` nem `snippet`, ao contrário da Brave).
 */
interface SearxngResult {
  readonly title?: string;
  readonly url?: string;
  readonly content?: string;
}

interface SearxngResponse {
  readonly results?: readonly SearxngResult[];
}

export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = 'searxng';
  readonly name = 'SearXNG';

  constructor(private readonly baseUrl: string) {}

  isConfigured(): boolean {
    return this.baseUrl.trim().length > 0;
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
    const url = new URL('/search', this.baseUrl.trim());
    url.searchParams.set('q', query.trim());
    url.searchParams.set('format', 'json');
    url.searchParams.set('count', String(RESULT_COUNT));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error('a pesquisa demorou demasiado e foi cancelada');
      }
      throw new Error(
        `não consegui ligar ao SearXNG em ${this.baseUrl} — confirma que a instância está a correr`,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? 'o SearXNG recusou o pedido em JSON — confirma que "json" está nos formatos permitidos (search.formats) do settings.yml da instância'
          : `o SearXNG devolveu ${response.status}`,
      );
    }

    const body = (await response.json()) as SearxngResponse;
    const results: readonly SearchResult[] = (body.results ?? [])
      .slice(0, RESULT_COUNT)
      .map((result) => ({
        title: result.title?.trim() || '(sem título)',
        snippet: result.content?.trim() ?? '',
        url: result.url ?? '',
      }))
      .filter((result) => result.url.length > 0);

    return { isSimulated: false, results };
  }
}
