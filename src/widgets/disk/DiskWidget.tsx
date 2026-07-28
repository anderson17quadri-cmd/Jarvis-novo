import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { cn } from '@/lib/cn';
import { formatBytes, formatPercent } from '@/lib/format';

/** A partir daqui o espaço livre deixa de ser um detalhe. */
const WARN_PERCENT = 85;
const DANGER_PERCENT = 95;

/**
 * Disco (Parte 6.2 §Widgets previstos).
 *
 * Espaço usado e livre, com os volumes por baixo. Leitura e gravação por
 * segundo ficam de fora: o `sysinfo` expõe totais acumulados por processo, não
 * o débito do disco, e derivar um número a partir disso seria inventá-lo — a
 * mesma razão pela qual não há widget de GPU.
 */
export default function DiskWidget(): React.JSX.Element {
  const { snapshot, isSupported } = useSystemMetrics();

  if (!isSupported) {
    return <WidgetEmpty message="Esta plataforma não expõe métricas do sistema." />;
  }

  if (!snapshot) return <WidgetSkeleton />;

  const { disk } = snapshot;
  const percent = Math.max(0, Math.min(100, disk.usagePercent));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[26px] font-light leading-none">
          {formatPercent(disk.usagePercent)}
        </span>
        <span className="text-[10.5px] text-t3">{formatBytes(disk.availableBytes)} livres</span>
      </div>

      <div
        className="mt-2.5 h-1.5 flex-shrink-0 overflow-hidden rounded-full bg-white/[.06]"
        role="progressbar"
        aria-label="Ocupação do disco"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700 ease-out',
            percent >= DANGER_PERCENT
              ? 'bg-danger'
              : percent >= WARN_PERCENT
                ? 'bg-warn'
                : 'bg-gradient-to-r from-neon to-accent',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-1.5 flex-shrink-0 text-[10.5px] text-t3">
        {formatBytes(disk.usedBytes)} de {formatBytes(disk.totalBytes)}
      </p>

      {disk.volumes.length > 0 && (
        <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {disk.volumes.map((volume) => {
            const used = volume.totalBytes - volume.availableBytes;
            const volumePercent =
              volume.totalBytes === 0 ? 0 : Math.round((used / volume.totalBytes) * 100);

            return (
              <li key={volume.mountPoint}>
                <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                  <span className="truncate text-t2">{volume.name || volume.mountPoint}</span>
                  <span className="mono flex-shrink-0 text-t3">
                    {formatBytes(volume.availableBytes)} livres
                  </span>
                </div>
                <div
                  className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/[.06]"
                  role="progressbar"
                  aria-label={`Ocupação de ${volume.name || volume.mountPoint}`}
                  aria-valuenow={volumePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-accent/70 transition-[width] duration-700 ease-out"
                    style={{ width: `${volumePercent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
