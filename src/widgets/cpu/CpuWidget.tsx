import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

/**
 * CPU (Parte 6.2 §Widgets previstos).
 *
 * Utilização global, gráfico em tempo real e a carga por núcleo. Os dados vêm
 * do `SystemService` — no browser são simulados, no desktop vêm do `sysinfo`
 * em Rust. O widget não sabe a diferença, e é esse o teste da abstração.
 */
export default function CpuWidget(): React.JSX.Element {
  const { snapshot, staticInfo, history, isSupported } = useSystemMetrics();

  const chartData = useMemo(
    () => history.map((point) => ({ at: point.at, cpu: point.cpu })),
    [history],
  );

  if (!isSupported) {
    return <WidgetEmpty message="Esta plataforma não expõe métricas do sistema." />;
  }

  if (!snapshot) return <WidgetSkeleton />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[26px] font-light leading-none compact:text-[20px]">
          {formatPercent(snapshot.cpu.usagePercent)}
        </span>
        <span className="text-[10.5px] text-t3">
          {snapshot.cpu.coreCount} núcleos
          {snapshot.cpu.frequencyMhz !== null && ` · ${(snapshot.cpu.frequencyMhz / 1000).toFixed(1)} GHz`}
        </span>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cpu-widget-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Eixo fixo em 0–100: sem isto uma oscilação de 2% parecia um pico. */}
            <YAxis domain={[0, 100]} hide />
            <Area
              type="monotone"
              dataKey="cpu"
              stroke="var(--accent)"
              strokeWidth={1.5}
              fill="url(#cpu-widget-fill)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Uma barra por núcleo — só cabe nos tamanhos maiores. */}
      {snapshot.cpu.perCore.length > 0 && (
        <div className="mt-2 flex flex-shrink-0 gap-[3px]" aria-hidden="true">
          {snapshot.cpu.perCore.slice(0, 16).map((usage, index) => (
            <span
              key={index}
              title={`Núcleo ${index + 1}: ${formatPercent(usage)}`}
              // `justify-end` faz a barra crescer de baixo para cima, que é como
              // um medidor se lê. Com `margin-top:auto` num bloco não funcionava.
              className="flex h-6 flex-1 flex-col justify-end overflow-hidden rounded-sm bg-tint/[.05]"
            >
              <span
                className={cn(
                  'w-full rounded-sm bg-accent transition-[height] duration-500 ease-out',
                  usage > 80 && 'bg-warn',
                )}
                style={{ height: `${Math.max(4, Math.min(100, usage))}%` }}
              />
            </span>
          ))}
        </div>
      )}

      {staticInfo?.cpuBrand && (
        <p className="mt-1.5 flex-shrink-0 truncate text-[10px] text-t3">{staticInfo.cpuBrand}</p>
      )}
    </div>
  );
}
