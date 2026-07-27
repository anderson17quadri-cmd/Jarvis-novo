import { useState } from 'react';
import { ExternalLink, Star } from 'lucide-react';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useDataService } from '@/hooks/use-data-service';
import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { newsService } from '@/services/news/news-service';
import { NEWS_CATEGORY_LABELS, type NewsCategory } from '@/types/news';

type Filter = NewsCategory | 'todas';

const FILTERS: readonly Filter[] = ['todas', 'tecnologia', 'ciencia', 'negocios', 'mundo'];

/** "há 3 h", "há 12 min" — mais útil do que uma hora absoluta numa lista. */
const RELATIVE = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });

function relativeTime(timestamp: number): string {
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, 'minute');
  return RELATIVE.format(Math.round(minutes / 60), 'hour');
}

/**
 * Notícias (Parte 6.2 §Widgets previstos).
 *
 * Categorias, favoritos e leitura rápida. Abrir um artigo passa pelo
 * `PlatformAdapter.openExternal`, que só aceita `https:` — o widget nunca abre
 * um endereço diretamente.
 */
export default function NewsWidget(): React.JSX.Element {
  const { data, isLoading } = useDataService(newsService);
  const [filter, setFilter] = useState<Filter>('todas');

  if (isLoading || !data) return <WidgetSkeleton />;

  const articles =
    filter === 'todas'
      ? data.articles
      : data.articles.filter((article) => article.category === filter);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-shrink-0 gap-1 overflow-x-auto">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={cn(
              'flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-all duration-hover',
              filter === option
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-line text-t3 hover:border-line-2 hover:text-t2',
            )}
          >
            {option === 'todas' ? 'Todas' : NEWS_CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>

      {articles.length === 0 ? (
        <WidgetEmpty message="Sem notícias nesta categoria." />
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {articles.map((article) => (
            <li
              key={article.id}
              className={cn(
                'group/article rounded-lg border border-transparent p-2 transition-colors',
                'hover:border-line hover:bg-white/[.03]',
                article.isRead && 'opacity-60',
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => void newsService.toggleFavorite(article.id)}
                  aria-label={
                    article.isFavorite
                      ? `Remover dos favoritos: ${article.title}`
                      : `Marcar como favorito: ${article.title}`
                  }
                  aria-pressed={article.isFavorite}
                  className="mt-0.5 flex-shrink-0 text-t3 transition-colors hover:text-warn"
                >
                  <Star
                    className={cn('h-3 w-3', article.isFavorite && 'fill-warn text-warn')}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-[1.35]">{article.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-[1.4] text-t3">
                    {article.summary}
                  </p>
                  <p className="mt-1 text-[9.5px] text-t3">
                    {article.source} · {relativeTime(article.publishedAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void newsService.markRead(article.id);
                    void getPlatformAdapter().openExternal(article.url);
                  }}
                  aria-label={`Abrir: ${article.title}`}
                  className="flex-shrink-0 text-t3 opacity-0 transition-opacity hover:text-accent group-hover/article:opacity-100 focus:opacity-100"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.isSimulated && (
        <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-t3">Notícias simuladas</p>
      )}
    </div>
  );
}
