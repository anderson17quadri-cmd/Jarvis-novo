import { AndroidAdapter } from './android-adapter';
import { DesktopAdapter } from './desktop-adapter';
import { detectPlatform } from './detect-platform';
import type { PlatformAdapter } from './platform-adapter';
import { WebAdapter } from './web-adapter';

export type { PlatformAdapter } from './platform-adapter';

/**
 * Fábrica e singleton do adapter.
 *
 * A deteção corre uma vez. Todos os serviços recebem a mesma instância, o que
 * garante que o `SystemMonitor` do Rust vê chamadas consecutivas — é disso que
 * depende o cálculo da percentagem de CPU.
 */

function createAdapter(): PlatformAdapter {
  switch (detectPlatform()) {
    case 'desktop':
      return new DesktopAdapter();
    case 'android':
      return new AndroidAdapter();
    case 'web':
      return new WebAdapter();
  }
}

let instance: PlatformAdapter | null = null;
let initialization: Promise<PlatformAdapter> | null = null;

export function getPlatformAdapter(): PlatformAdapter {
  instance ??= createAdapter();
  return instance;
}

/**
 * Cria o adapter e corre a inicialização, uma só vez.
 * Chamado no arranque da aplicação, antes de qualquer serviço ser usado.
 */
export function initializePlatform(): Promise<PlatformAdapter> {
  initialization ??= (async () => {
    const adapter = getPlatformAdapter();
    await adapter.initialize();
    return adapter;
  })();
  return initialization;
}

/** Só para testes: descarta o singleton entre casos. */
export function resetPlatformAdapterForTesting(next: PlatformAdapter | null = null): void {
  instance = next;
  initialization = null;
}
