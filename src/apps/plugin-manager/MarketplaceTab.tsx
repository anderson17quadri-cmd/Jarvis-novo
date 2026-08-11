import { AlertTriangle, Download, Star } from 'lucide-react';

import { cn } from '@/lib/cn';
import { PLUGIN_CATEGORY_LABELS } from './plugin-catalog';
import { MARKETPLACE_LISTINGS, type MarketplaceListing } from './marketplace-sample-data';

const INSTALL_FORMATTER = new Intl.NumberFormat('pt-PT');

/**
 * Esboço do Marketplace (Parte 11 §Marketplace, atualizações, rollback).
 *
 * Só desenho: os cartões abaixo são dados de exemplo, escritos à mão, sem
 * nenhuma origem remota real por trás. "Instalar" fica sempre desativado —
 * ligar isto a uma fonte a sério é uma decisão à parte, documentada em
 * `docs/spec/plugins-marketplace.md`, não algo para simular como se já
 * estivesse decidido.
 */
export function MarketplaceTab(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-s3">
      <p className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap text-t2">
        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
        <span>
          Esboço, não uma loja a sério: os plugins abaixo são dados de exemplo, escritos à mão —
          nenhum vem de um servidor real, e "Instalar" não faz nada. O que falta decidir antes
          disto ligar a uma fonte real está em{' '}
          <code className="mono text-[11px]">docs/spec/plugins-marketplace.md</code>.
        </span>
      </p>

      <ul className="flex flex-col gap-2.5 overflow-y-auto pr-0.5">
        {MARKETPLACE_LISTINGS.map((listing) => (
          <MarketplaceCard key={listing.id} listing={listing} />
        ))}
      </ul>
    </div>
  );
}

function MarketplaceCard({ listing }: { readonly listing: MarketplaceListing }): React.JSX.Element {
  return (
    <li className="rounded-input border border-line bg-tint/[.02] p-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium">
            {listing.name}
            <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-t3">
              {PLUGIN_CATEGORY_LABELS[listing.category]}
            </span>
          </p>
          <p className="mt-0.5 text-cap text-t3">{listing.tagline}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-t3">
            <span>{listing.author}</span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-accent" aria-hidden="true" />
              {listing.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" aria-hidden="true" />
              {INSTALL_FORMATTER.format(listing.downloads)}
            </span>
            <span>{listing.publishedAgo}</span>
          </p>
        </div>

        <span
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
            listing.pricing === 'gratuito'
              ? 'bg-ok/[.1] text-ok'
              : 'bg-accent/[.1] text-accent',
          )}
        >
          {listing.pricing === 'gratuito' ? 'Grátis' : 'Pago'}
        </span>
      </div>

      <div className="mt-3">
        <button
          type="button"
          disabled
          title="Esboço — sem ligação a uma fonte real, ver docs/spec/plugins-marketplace.md"
          className="flex min-h-[36px] cursor-not-allowed items-center gap-1.5 rounded-btn border border-line bg-tint/[.03] px-3 py-2 text-[12px] font-medium text-t3 opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Instalar
        </button>
      </div>
    </li>
  );
}
