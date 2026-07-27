import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { formatBytes, formatPercent } from '@/lib/format';

/**
 * Memória (Parte 6.2 §Widgets previstos).
 *
 * Uso, disponível, swap e histórico. Tal como o widget de CPU, não sabe se os
 * dados vêm do `sysinfo` ou da simulação — pergunta ao `SystemService`.
 */
export default function RamWidget(): React.JSX.Element {
  const { snapshot, history, isSupported } = useSystemMetrics();

  const chartData = useMemo(
    () => history.map((point) => ({ at: point.at, memory: point.memory })),
    [history],
  );

  if (!isSupported) {
    return <WidgetEmpty message="Esta plataforma não expõe métricas do sistema." />;
  }

  if (!snapshot) return <WidgetSkeleton />;

  const { memory } = snapshot;
  const hasSwap = memory.swapTotalBytes > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[26px] font-light leading-none">
          {formatPercent(memory.usagePercent)}
        </span>
        <span className="mono text-[10.5px] text-t3">
          {formatBytes(memory.usedBytes)} / {formatBytes(memory.totalBytes)}
        </span>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ram-widget-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--neon)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--neon)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <Area
              type="monotone"
              dataKey="memory"
              stroke="var(--neon)"
              strokeWidth={1.5}
              fill="url(#ram-widget-fill)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-2 flex flex-shrink-0 justify-between text-[10.5px]">
        <div>
          <dt className="text-t3">Disponível</dt>
          <dd className="mono mt-0.5 text-t2">{formatBytes(memory.availableBytes)}</dd>
        </div>

        {/* O swap só aparece onde existe — no Android costuma não haver. */}
        {hasSwap && (
          <div className="text-right">
            <dt className="text-t3">Swap</dt>
            <dd className="mono mt-0.5 text-t2">
              {formatBytes(memory.swapUsedBytes)} / {formatBytes(memory.swapTotalBytes)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
