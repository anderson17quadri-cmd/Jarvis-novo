/**
 * Espelho TypeScript das estruturas que o Rust serializa
 * (`src-tauri/src/system/metrics.rs`).
 *
 * Os campos `null` são os que uma plataforma não consegue responder. `null` quer
 * dizer "não é possível saber aqui" — nunca zero, que seria uma medição falsa.
 */

export interface CpuMetrics {
  readonly usagePercent: number;
  readonly perCore: readonly number[];
  readonly coreCount: number;
  readonly frequencyMhz: number | null;
}

export interface MemoryMetrics {
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly availableBytes: number;
  readonly usagePercent: number;
  readonly swapTotalBytes: number;
  readonly swapUsedBytes: number;
}

export interface VolumeMetrics {
  readonly name: string;
  readonly mountPoint: string;
  readonly totalBytes: number;
  readonly availableBytes: number;
}

export interface DiskMetrics {
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly availableBytes: number;
  readonly usagePercent: number;
  readonly volumes: readonly VolumeMetrics[];
}

export interface NetworkMetrics {
  readonly receivedBytes: number;
  readonly transmittedBytes: number;
  readonly downloadBytesPerSec: number;
  readonly uploadBytesPerSec: number;
  readonly totalReceivedBytes: number;
  readonly totalTransmittedBytes: number;
}

export interface GpuMetrics {
  readonly name: string;
  readonly usagePercent: number | null;
  readonly memoryUsedBytes: number | null;
  readonly memoryTotalBytes: number | null;
}

export interface SystemSnapshot {
  readonly cpu: CpuMetrics;
  readonly memory: MemoryMetrics;
  readonly disk: DiskMetrics;
  readonly network: NetworkMetrics;
  /** `null` em todas as plataformas por agora — o sysinfo não lê a GPU. */
  readonly gpu: GpuMetrics | null;
  readonly capturedAt: number;
}

export interface StaticSystemInfo {
  readonly osName: string | null;
  readonly osVersion: string | null;
  readonly kernelVersion: string | null;
  readonly hostName: string | null;
  readonly cpuBrand: string;
  readonly cpuArch: string;
  readonly coreCount: number;
  readonly totalMemoryBytes: number;
}

export interface ProcessInfo {
  readonly pid: number;
  readonly name: string;
  readonly cpuPercent: number;
  readonly memoryBytes: number;
}

/** As métricas que o Monitor de recursos desenha, na ordem em que aparecem. */
export const METRIC_KEYS = ['cpu', 'memory', 'gpu', 'network', 'disk'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
