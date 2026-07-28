import { useMemo } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { formatBytes, formatBytesPerSecond } from '@/lib/format';

/**
 * Rede (Parte 6.2 §Widgets previstos).
 *
 * Débito de descarga e envio, com o histórico recente e os totais da sessão.
 *
 * Latência e endereço IP ficam de fora: medir latência exige contactar um
 * servidor — rede real, bloqueada — e o IP não está no `SystemSnapshot`. Nada
 * disto aparece com um valor de encomenda.
 */
export default function NetworkWidget(): React.JSX.Element {
  const { snapshot, history, isSupported } = useSystemMetrics();

  const chartData = useMemo(
    () =>
      history.map((point) => ({
        at: point.at,
        download: point.downloadBytesPerSec,
        upload: point.uploadBytesPerSec,
      })),
    [history],
  );

  /**
   * Teto do gráfico.
   *
   * Com eixo automático, uma rede parada desenhava picos enormes a partir de
   * ruído. O mínimo de 64 KB/s dá uma linha de base estável, e acima disso o
   * eixo acompanha o máximo do histórico.
   */
  const ceiling = useMemo(() => {
    const peak = Math.max(
      64 * 1024,
      ...chartData.map((point) => Math.max(point.download, point.upload)),
    );
    return peak * 1.15;
  }, [chartData]);

  if (!isSupported) {
    return <WidgetEmpty message="Esta plataforma não expõe métricas do sistema." />;
  }

  if (!snapshot) return <WidgetSkeleton />;

  const { network } = snapshot;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-baseline gap-3">
        <span className="flex items-baseline gap-1">
          <ArrowDown className="h-3.5 w-3.5 self-center text-accent" aria-hidden="true" />
          <span className="mono text-[17px] font-light leading-none">
            {formatBytesPerSecond(network.downloadBytesPerSec)}
          </span>
        </span>
        <span className="flex items-baseline gap-1">
          <ArrowUp className="h-3.5 w-3.5 self-center text-neon" aria-hidden="true" />
          <span className="mono text-[17px] font-light leading-none text-t2">
            {formatBytesPerSecond(network.uploadBytesPerSec)}
          </span>
        </span>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="net-down-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="net-up-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--neon)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--neon)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <YAxis domain={[0, ceiling]} hide />

            <Area
              type="monotone"
              dataKey="download"
              stroke="var(--accent)"
              strokeWidth={1.5}
              fill="url(#net-down-fill)"
              isAnimationActive={false}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="upload"
              stroke="var(--neon)"
              strokeWidth={1.2}
              fill="url(#net-up-fill)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1.5 flex-shrink-0 text-[10px] text-t3">
        Sessão: {formatBytes(network.totalReceivedBytes)} recebidos ·{' '}
        {formatBytes(network.totalTransmittedBytes)} enviados
      </p>
    </div>
  );
}
