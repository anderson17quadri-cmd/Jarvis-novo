import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

import { useCapabilities } from '@/hooks/use-platform';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { cn } from '@/lib/cn';
import { formatBytes, formatBytesPerSecond, formatPercent } from '@/lib/format';
import type { SystemSnapshot } from '@/types/system';

/**
 * Monitor de recursos — dados reais.
 *
 * As métricas vêm do `SystemService`, que no desktop e no Android chega ao
 * `sysinfo` em Rust e no browser usa a simulação. A janela não sabe a diferença.
 *
 * O que a plataforma não consegue medir não aparece: a GPU não tem cartão
 * porque o `sysinfo` não a lê, e a lista de processos não aparece no Android
 * porque o sistema não a permite. Nenhum dos dois mostra zero.
 */
export default function ResourceMonitorWindow(): React.JSX.Element {
  const { snapshot, staticInfo, history, isSupported } = useSystemMetrics();
  const capabilities = useCapabilities();

  const chartData = useMemo(
    () => history.map((point) => ({ at: point.at, cpu: point.cpu, memory: point.memory })),
    [history],
  );

  if (!isSupported) {
    return (
      <p className="text-desc text-t3">
        Esta plataforma não expõe métricas do sistema.
      </p>
    );
  }

  if (!snapshot) {
    return <p className="text-desc text-t3">A ler o estado do sistema…</p>;
  }

  return (
    <div className="flex flex-col gap-s3">
      {staticInfo && (
        <header>
          <p className="t-label">{staticInfo.cpuBrand || 'Processador'}</p>
          <p className="mt-1 text-[11.5px] text-t3">
            {[staticInfo.osName, staticInfo.osVersion].filter(Boolean).join(' ')} ·{' '}
            {staticInfo.coreCount} núcleos · {formatBytes(staticInfo.totalMemoryBytes)}
          </p>
        </header>
      )}

      <section aria-label="Histórico de utilização">
        <div className="h-[110px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cpu-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memory-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--neon)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--neon)" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Eixo fixo em 0–100: sem isto o gráfico reescalava a cada leitura
                  e uma oscilação de 2% parecia um pico. */}
              <YAxis domain={[0, 100]} hide />
              <Tooltip content={<ChartTooltip />} cursor={false} />

              <Area
                type="monotone"
                dataKey="cpu"
                stroke="var(--accent)"
                strokeWidth={1.6}
                fill="url(#cpu-fill)"
                isAnimationActive={false}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="memory"
                stroke="var(--neon)"
                strokeWidth={1.2}
                fill="url(#memory-fill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 flex gap-s2 text-[10px] uppercase tracking-[0.12em] text-t3">
          <LegendDot color="var(--accent)" label="CPU" />
          <LegendDot color="var(--neon)" label="Memória" />
        </div>
      </section>

      <section aria-label="Métricas atuais" className="flex flex-col gap-3.5">
        <Metric
          label="CPU"
          value={formatPercent(snapshot.cpu.usagePercent)}
          percent={snapshot.cpu.usagePercent}
        />
        <Metric
          label="Memória"
          value={`${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}`}
          percent={snapshot.memory.usagePercent}
        />
        <Metric
          label="Disco"
          value={`${formatBytes(snapshot.disk.usedBytes)} / ${formatBytes(snapshot.disk.totalBytes)}`}
          percent={snapshot.disk.usagePercent}
        />
        <NetworkRow snapshot={snapshot} />

        {/* A GPU só aparece se a plataforma souber lê-la. Hoje nunca sabe. */}
        {snapshot.gpu && (
          <Metric
            label={snapshot.gpu.name}
            value={snapshot.gpu.usagePercent === null ? '—' : formatPercent(snapshot.gpu.usagePercent)}
            percent={snapshot.gpu.usagePercent ?? 0}
          />
        )}
      </section>

      {!capabilities.processList && (
        <p className="text-[11.5px] text-t3">
          A lista de processos não está disponível nesta plataforma.
        </p>
      )}
    </div>
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly percent: number;
}

function Metric({ label, value, percent }: MetricProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div>
      <div className="mb-[7px] flex items-baseline justify-between">
        <span className="text-[12.5px] text-t2">{label}</span>
        <span className="mono text-[12.5px] font-semibold">{value}</span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-tint/[.06]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-neon to-accent',
            'shadow-[0_0_10px_rgba(0,207,255,.4)] transition-[width] duration-700 ease-out',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function NetworkRow({ snapshot }: { readonly snapshot: SystemSnapshot }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12.5px] text-t2">Rede</span>
      <span className="mono text-[12.5px] font-semibold">
        ↓ {formatBytesPerSecond(snapshot.network.downloadBytesPerSec)} · ↑{' '}
        {formatBytesPerSecond(snapshot.network.uploadBytesPerSec)}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { readonly color: string; readonly label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

interface TooltipPayload {
  readonly dataKey?: string | number;
  readonly value?: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  readonly active?: boolean;
  readonly payload?: readonly TooltipPayload[];
}): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-glass/[.95] px-2.5 py-1.5 text-[11px] backdrop-blur-soft">
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="mono">
          {entry.dataKey === 'cpu' ? 'CPU' : 'Memória'}: {formatPercent(entry.value ?? 0, 1)}
        </div>
      ))}
    </div>
  );
}
