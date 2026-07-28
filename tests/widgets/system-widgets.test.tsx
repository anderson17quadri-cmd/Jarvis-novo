import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DiskWidget from '@/widgets/disk/DiskWidget';
import NetworkWidget from '@/widgets/network/NetworkWidget';
import { WIDGET_REGISTRY } from '@/widgets/registry';
import { systemService } from '@/services/system-service';
import { useSystemStore } from '@/stores/use-system-store';
import type { SystemSnapshot } from '@/types/system';

/**
 * O `useSystemMetrics` subscreve o `systemService` ao montar, e no jsdom o
 * `WebAdapter` simula métricas — que passavam por cima das do teste no
 * primeiro tick. Aqui a sondagem é substituída por uma leitura fixa.
 */
function feed(snapshot: SystemSnapshot | null): void {
  vi.spyOn(systemService, 'isSupported', 'get').mockReturnValue(snapshot !== null);
  vi.spyOn(systemService, 'getStaticInfo').mockResolvedValue(null);
  vi.spyOn(systemService, 'subscribe').mockImplementation((listener) => {
    if (snapshot) listener(snapshot);
    return () => undefined;
  });
}

function makeSnapshot(): SystemSnapshot {
  return {
    cpu: { usagePercent: 20, perCore: [20, 20], coreCount: 2, frequencyMhz: 3_600 },
    memory: {
      totalBytes: 16 * 1024 ** 3,
      usedBytes: 8 * 1024 ** 3,
      availableBytes: 8 * 1024 ** 3,
      usagePercent: 50,
      swapTotalBytes: 0,
      swapUsedBytes: 0,
    },
    disk: {
      totalBytes: 500 * 1024 ** 3,
      usedBytes: 460 * 1024 ** 3,
      availableBytes: 40 * 1024 ** 3,
      usagePercent: 92,
      volumes: [
        {
          name: 'Sistema',
          mountPoint: '/',
          totalBytes: 500 * 1024 ** 3,
          availableBytes: 40 * 1024 ** 3,
        },
      ],
    },
    network: {
      receivedBytes: 0,
      transmittedBytes: 0,
      downloadBytesPerSec: 2 * 1024 ** 2,
      uploadBytesPerSec: 256 * 1024,
      totalReceivedBytes: 3 * 1024 ** 3,
      totalTransmittedBytes: 512 * 1024 ** 2,
    },
    gpu: null,
    capturedAt: Date.now(),
  };
}

beforeEach(() => {
  useSystemStore.setState({ snapshot: null, history: [], isSupported: true, staticInfo: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('widget de Disco', () => {
  it('sem plataforma que meça, diz que não sabe em vez de mostrar zeros', () => {
    feed(null);
    render(<DiskWidget />);

    expect(screen.getByText(/não expõe métricas/i)).toBeInTheDocument();
  });

  it('mostra a ocupação e o espaço livre', () => {
    feed(makeSnapshot());
    render(<DiskWidget />);

    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ocupação do disco' })).toHaveAttribute(
      'aria-valuenow',
      '92',
    );
  });

  it('cada volume tem a sua barra, anunciada pelo nome', () => {
    feed(makeSnapshot());
    render(<DiskWidget />);

    expect(
      screen.getByRole('progressbar', { name: 'Ocupação de Sistema' }),
    ).toBeInTheDocument();
  });
});

describe('widget de Rede', () => {
  it('sem plataforma que meça, diz que não sabe', () => {
    feed(null);
    render(<NetworkWidget />);

    expect(screen.getByText(/não expõe métricas/i)).toBeInTheDocument();
  });

  it('mostra descarga, envio e os totais da sessão', () => {
    feed(makeSnapshot());
    render(<NetworkWidget />);

    expect(screen.getByText('2,0 MB/s')).toBeInTheDocument();
    expect(screen.getByText(/recebidos/)).toBeInTheDocument();
  });
});

describe('registo', () => {
  it('os dois novos declaram que precisam de métricas', () => {
    for (const id of ['disk', 'network'] as const) {
      expect(WIDGET_REGISTRY[id].permissions.systemMetrics).toBe(true);
      // Não abrem ligações nenhumas: leem o que o sistema já mede.
      expect(WIDGET_REGISTRY[id].permissions.network).toBe(false);
    }
  });

  it('nenhum dos dois entra no arranjo inicial — a grelha já está composta', () => {
    expect(WIDGET_REGISTRY.disk.showByDefault).toBe(false);
    expect(WIDGET_REGISTRY.network.showByDefault).toBe(false);
  });
});
