import { useMemo, useState } from 'react';
import { Info, Search } from 'lucide-react';

import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { usePluginStore } from '@/stores/use-plugin-store';
import { normalizeSearch } from '@/utils/text';
import { PluginCard } from './PluginCard';
import {
  PLUGIN_CATALOG,
  PLUGIN_CATEGORY_LABELS,
  type CatalogEntry,
  type PluginCategory,
} from './plugin-catalog';

/**
 * Loja de plugins.
 *
 * **Só interface.** Instalar escreve no `usePluginStore` e mais nada: nenhum
 * código é descarregado nem executado. O carregamento real exige sandbox,
 * verificação de assinatura e acesso ao sistema de ficheiros — tudo bloqueado
 * até a camada nativa correr num PC (ver `SPEC.md` §Estado de verificação).
 *
 * A disponibilidade de cada plugin sai da comparação entre o que ele exige e o
 * que `useCapabilities()` diz — em nenhum ponto desta janela se pergunta em que
 * plataforma estamos.
 */

type Tab = 'loja' | 'instalados';

/** `null` é "Todas". */
type CategoryFilter = PluginCategory | null;

export default function PluginManagerWindow(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('loja');
  const [category, setCategory] = useState<CategoryFilter>(null);
  const [query, setQuery] = useState('');

  const installed = usePluginStore((state) => state.installed);
  const capabilities = useCapabilities();

  const visible = useMemo(() => {
    const normalized = normalizeSearch(query);

    return PLUGIN_CATALOG.filter((entry) => {
      if (tab === 'instalados' && !installed[entry.id]) return false;
      if (category !== null && entry.category !== category) return false;
      if (normalized.length === 0) return true;

      return normalizeSearch(
        `${entry.name} ${entry.tagline} ${entry.description} ${entry.author} ${PLUGIN_CATEGORY_LABELS[entry.category]}`,
      ).includes(normalized);
    });
  }, [category, installed, query, tab]);

  const installedCount = Object.keys(installed).length;

  return (
    <div className="flex h-full flex-col gap-s3">
      <p className="flex items-start gap-2 rounded-input border border-line bg-tint/[.02] p-2.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Modo de demonstração: nenhum plugin é descarregado nem executado. Instalar regista a
          escolha; a execução chega com a camada nativa.
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vista" className="flex gap-1">
          <TabButton isActive={tab === 'loja'} onClick={() => setTab('loja')}>
            Loja
          </TabButton>
          <TabButton isActive={tab === 'instalados'} onClick={() => setTab('instalados')}>
            Instalados ({installedCount})
          </TabButton>
        </div>

        <label className="relative ml-auto flex min-w-[150px] flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-t3"
            aria-hidden="true"
          />
          <span className="sr-only">Pesquisar plugins</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar…"
            className={cn(
              'w-full rounded-input border border-line bg-tint/[.03] py-2 pl-8 pr-2.5',
              'text-[12.5px] text-t1 outline-none transition-colors duration-hover',
              'placeholder:text-t3 focus:border-accent/45',
            )}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorias">
        <CategoryChip isActive={category === null} onClick={() => setCategory(null)}>
          Todas
        </CategoryChip>
        {(Object.keys(PLUGIN_CATEGORY_LABELS) as PluginCategory[]).map((id) => (
          <CategoryChip key={id} isActive={category === id} onClick={() => setCategory(id)}>
            {PLUGIN_CATEGORY_LABELS[id]}
          </CategoryChip>
        ))}
      </div>

      <ul className="flex flex-col gap-2.5 overflow-y-auto pr-0.5">
        {visible.map((entry: CatalogEntry) => (
          <PluginCard key={entry.id} entry={entry} capabilities={capabilities} />
        ))}

        {visible.length === 0 && (
          <li className="py-s3 text-center text-desc text-t3">
            {tab === 'instalados'
              ? 'Ainda não instalou nenhum plugin desta categoria.'
              : 'Nenhum plugin corresponde à pesquisa.'}
          </li>
        )}
      </ul>
    </div>
  );
}

interface ChipProps {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function TabButton({ isActive, onClick, children }: ChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'rounded-input border px-3 py-2 text-[12.5px] font-medium transition-all duration-hover ease-out',
        // 44px de altura em toque não cabem aqui sem partir o cabeçalho; estes
        // controlos ficam em 36px e são secundários face aos botões do cartão.
        isActive
          ? 'border-accent bg-accent/[.08] text-accent'
          : 'border-line text-t2 hover:border-accent/35 hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}

function CategoryChip({ isActive, onClick, children }: ChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] transition-all duration-hover ease-out',
        isActive
          ? 'border-accent/60 bg-accent/[.1] text-accent'
          : 'border-line text-t3 hover:border-accent/30 hover:text-t2',
      )}
    >
      {children}
    </button>
  );
}
