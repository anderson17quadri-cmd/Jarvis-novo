import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handlePluginMessage } from '@/plugins/runtime/plugin-bridge';
import { logService } from '@/services/log-service';
import { useNotificationStore } from '@/stores/use-notification-store';
import { usePluginStore } from '@/stores/use-plugin-store';

/**
 * Ficheiros e rede correm fora do Tauri em teste — mockados aqui, porque a
 * confirmação a sério (com o `fs` e a rede verdadeiros) é feita na app a
 * correr, não em `jsdom`. Ver `docs/spec/plugins-sandbox.md`.
 */
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => '/appdata',
  join: async (...parts: string[]) => parts.join('/'),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(async (path: string) => `conteudo-de:${path}`),
  writeTextFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async () => [{ name: 'nota.txt', isDirectory: false }]),
}));

/**
 * A ponte entre um plugin isolado (iframe sandboxed) e o Core (Parte 11 —
 * execução real de plugins). O componente `PluginRuntime.tsx` só entrega
 * mensagens já validadas a `handlePluginMessage`; toda a decisão de
 * permissão vive aqui, testável sem DOM nenhum.
 *
 * `handlePluginMessage` é sempre assíncrona — as capacidades de ficheiros e
 * rede são operações de I/O, e as síncronas (notificações) resolvem-se no
 * próprio tick.
 */

const PLUGIN_ID = 'ola-notificacao';

function notifyRequest(requestId = 'req-1') {
  return {
    type: 'core.notify' as const,
    requestId,
    payload: { titulo: 'Olá do plugin', corpo: 'corpo de teste' },
  };
}

beforeEach(() => {
  usePluginStore.setState({ deniedPermissions: {} });
  useNotificationStore.setState({ notifications: [] });
  logService.clear();
});

describe('handlePluginMessage — core.notify', () => {
  it('permissão concedida (omissão do manifesto): notifica a sério e confirma', async () => {
    const ack = await handlePluginMessage(PLUGIN_ID, notifyRequest());

    expect(ack).toEqual({ type: 'core.ack', requestId: 'req-1', ok: true });
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().notifications[0]?.title).toBe('Olá do plugin');
  });

  it('permissão recusada: não notifica, e diz que recusou', async () => {
    usePluginStore.getState().setPermission(PLUGIN_ID, 'notifications', false);

    const ack = await handlePluginMessage(PLUGIN_ID, notifyRequest('req-2'));

    expect(ack).toEqual({
      type: 'core.ack',
      requestId: 'req-2',
      ok: false,
      reason: 'permissao-negada',
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('permitir de volta deixa o pedido seguinte passar', async () => {
    usePluginStore.getState().setPermission(PLUGIN_ID, 'notifications', false);
    await handlePluginMessage(PLUGIN_ID, notifyRequest('req-3'));
    expect(useNotificationStore.getState().notifications).toHaveLength(0);

    usePluginStore.getState().setPermission(PLUGIN_ID, 'notifications', true);
    await handlePluginMessage(PLUGIN_ID, notifyRequest('req-4'));
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it('fica auditado, permitido e recusado', async () => {
    await handlePluginMessage(PLUGIN_ID, notifyRequest('req-5'));
    usePluginStore.getState().setPermission(PLUGIN_ID, 'notifications', false);
    await handlePluginMessage(PLUGIN_ID, notifyRequest('req-6'));

    const entradas = logService.list.filter((entry) => entry.message.includes(PLUGIN_ID));
    expect(entradas.some((entry) => entry.message.includes('executado'))).toBe(true);
    expect(entradas.some((entry) => entry.message.includes('recusado'))).toBe(true);
  });

  it('a decisão é por plugin — recusar um não afeta outro', async () => {
    usePluginStore.getState().setPermission('outro-plugin', 'notifications', false);

    const ack = await handlePluginMessage(PLUGIN_ID, notifyRequest('req-7'));

    expect(ack.ok).toBe(true);
  });
});

describe('handlePluginMessage — core.automation.run', () => {
  it('automação que não existe devolve ok:false', async () => {
    const ack = await handlePluginMessage(PLUGIN_ID, {
      type: 'core.automation.run',
      requestId: 'req-aut-1',
      payload: { nome: 'automação-que-não-existe' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('automação-não-encontrada');
  });
});

describe('handlePluginMessage — validação de domínios', () => {
  it('plugin sem domínios autorizados devolve ok:false', async () => {
    // o 'ola-notificacao' não tem allowedDomains
    const ack = await handlePluginMessage(PLUGIN_ID, {
      type: 'core.fetch',
      requestId: 'req-net-1',
      payload: { url: 'https://api.github.com/status' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('sem-dominios-autorizados');
  });
});

describe('handlePluginMessage — ficheiros (ola-ficheiro, filesystemRoot declarado)', () => {
  const FS_PLUGIN_ID = 'ola-ficheiro';

  it('sem filesystemRoot declarado (ola-notificacao), recusa antes de tocar no disco', async () => {
    const ack = await handlePluginMessage(PLUGIN_ID, {
      type: 'core.fs.write',
      requestId: 'req-fs-1',
      payload: { caminho: 'nota.txt', conteudo: 'x' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('sem-raiz-declarada');
  });

  it('escreve e lê dentro da própria pasta, com filesystemRoot declarado', async () => {
    const escrita = await handlePluginMessage(FS_PLUGIN_ID, {
      type: 'core.fs.write',
      requestId: 'req-fs-2',
      payload: { caminho: 'nota.txt', conteudo: 'olá' },
    });
    expect(escrita.ok).toBe(true);

    const leitura = await handlePluginMessage(FS_PLUGIN_ID, {
      type: 'core.fs.read',
      requestId: 'req-fs-3',
      payload: { caminho: 'nota.txt' },
    });
    expect(leitura.ok).toBe(true);
    const dados = leitura.data as { conteudo: string };
    expect(dados.conteudo).toContain('nota.txt');
  });

  it('um caminho com ".." é recusado antes de chegar ao disco — não sai da própria pasta', async () => {
    const ack = await handlePluginMessage(FS_PLUGIN_ID, {
      type: 'core.fs.read',
      requestId: 'req-fs-4',
      payload: { caminho: '../outra-pasta/segredo.txt' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toContain('fs-read');
  });

  it('recusar a permissão de ficheiros bloqueia a escrita a sério', async () => {
    usePluginStore.getState().setPermission(FS_PLUGIN_ID, 'filesystem', false);

    const ack = await handlePluginMessage(FS_PLUGIN_ID, {
      type: 'core.fs.write',
      requestId: 'req-fs-5',
      payload: { caminho: 'nota.txt', conteudo: 'x' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });
});

describe('handlePluginMessage — rede (ola-rede, allowedDomains declarado)', () => {
  const NET_PLUGIN_ID = 'ola-rede';
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('domínio autorizado: o pedido sai a sério', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    globalThis.fetch = fetchMock;

    const ack = await handlePluginMessage(NET_PLUGIN_ID, {
      type: 'core.fetch',
      requestId: 'req-net-2',
      payload: { url: 'https://jsonplaceholder.typicode.com/todos/1' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(ack.ok).toBe(true);
  });

  it('domínio fora da lista autorizada é recusado, mesmo pedido pelo próprio plugin', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const ack = await handlePluginMessage(NET_PLUGIN_ID, {
      type: 'core.fetch',
      requestId: 'req-net-3',
      payload: { url: 'https://evil.example.com/roubar' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toContain('dominio-nao-autorizado');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recusar a permissão de rede impede o pedido antes de validar o domínio', async () => {
    usePluginStore.getState().setPermission(NET_PLUGIN_ID, 'network', false);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const ack = await handlePluginMessage(NET_PLUGIN_ID, {
      type: 'core.fetch',
      requestId: 'req-net-4',
      payload: { url: 'https://jsonplaceholder.typicode.com/todos/1' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
