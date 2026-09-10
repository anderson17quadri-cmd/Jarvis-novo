import type { StaticSystemInfo, SystemSnapshot } from '@/types/system';

/**
 * Métricas simuladas para o `WebAdapter`.
 *
 * Servem para desenvolver a interface no browser sem compilar o Tauri. Os
 * valores oscilam suavemente à volta de uma base — em vez de saltarem ao acaso —
 * para que os gráficos se pareçam com dados reais e os bugs de animação
 * apareçam durante o desenvolvimento.
 */

const GIB = 1024 ** 3;

/** Base e amplitude de cada métrica, em percentagem. */
const PROFILE = {
  cpu: { base: 22, swing: 14, period: 9_000 },
  memory: { base: 54, swing: 8, period: 23_000 },
  disk: { base: 63, swing: 1, period: 90_000 },
} as const;

const TOTAL_MEMORY = 32 * GIB;
const TOTAL_DISK = 1024 * GIB;

/** Oscilação suave: duas sinusóides de períodos diferentes, mais um ruído leve. */
function oscillate(base: number, swing: number, period: number, at: number, phase: number): number {
  const slow = Math.sin((at / period) * Math.PI * 2 + phase);
  const fast = Math.sin((at / (period / 3.7)) * Math.PI * 2 + phase * 1.6) * 0.35;
  const value = base + ((slow + fast) / 1.35) * swing;
  return Math.min(100, Math.max(0, value));
}

export function simulateSnapshot(coreCount = 12): SystemSnapshot {
  const now = Date.now();

  const cpuUsage = oscillate(PROFILE.cpu.base, PROFILE.cpu.swing, PROFILE.cpu.period, now, 0);
  const memoryUsage = oscillate(
    PROFILE.memory.base,
    PROFILE.memory.swing,
    PROFILE.memory.period,
    now,
    1.2,
  );
  const diskUsage = oscillate(PROFILE.disk.base, PROFILE.disk.swing, PROFILE.disk.period, now, 2.4);

  // Cada núcleo desvia-se da média com uma fase própria — como num CPU real.
  const perCore = Array.from({ length: coreCount }, (_, index) =>
    oscillate(cpuUsage, 18, 4_200 + index * 340, now, index * 0.7),
  );

  const memoryUsed = Math.round((memoryUsage / 100) * TOTAL_MEMORY);
  const diskUsed = Math.round((diskUsage / 100) * TOTAL_DISK);
  const download = Math.max(0, oscillate(45, 40, 6_000, now, 0.4)) * 220_000;
  const upload = Math.max(0, oscillate(12, 11, 7_500, now, 1.9)) * 60_000;

  return {
    cpu: {
      usagePercent: cpuUsage,
      perCore,
      coreCount,
      frequencyMhz: 3_600,
    },
    memory: {
      totalBytes: TOTAL_MEMORY,
      usedBytes: memoryUsed,
      availableBytes: TOTAL_MEMORY - memoryUsed,
      usagePercent: memoryUsage,
      swapTotalBytes: 8 * GIB,
      swapUsedBytes: Math.round(0.7 * GIB),
    },
    disk: {
      totalBytes: TOTAL_DISK,
      usedBytes: diskUsed,
      availableBytes: TOTAL_DISK - diskUsed,
      usagePercent: diskUsage,
      volumes: [
        {
          name: 'Disco do sistema',
          mountPoint: 'C:\\',
          totalBytes: TOTAL_DISK,
          availableBytes: TOTAL_DISK - diskUsed,
        },
      ],
    },
    network: {
      receivedBytes: Math.round(download),
      transmittedBytes: Math.round(upload),
      downloadBytesPerSec: download,
      uploadBytesPerSec: upload,
      totalReceivedBytes: Math.round(now / 1_000) * 180_000,
      totalTransmittedBytes: Math.round(now / 1_000) * 42_000,
    },
    // Coerente com o Tauri: também aqui a GPU não é lida.
    gpu: null,
    capturedAt: now,
  };
}

export function simulateStaticInfo(): StaticSystemInfo {
  return {
    osName: 'Simulado',
    osVersion: '—',
    kernelVersion: null,
    hostName: 'jarvis-web',
    cpuBrand: 'CPU simulado (modo browser)',
    cpuArch: 'x86_64',
    coreCount: 12,
    totalMemoryBytes: TOTAL_MEMORY,
  };
}
