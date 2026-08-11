import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPluginCommands, clearPluginSubscriptions, getPluginCommands, handlePluginMessage } from '@/plugins/runtime/plugin-bridge';
import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { useNotificationStore } from '@/stores/use-notification-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useWindowStore } from '@/stores/use-window-store';

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

// ═══════════════════════════════════════════════════════════════════════════════
// Capacidades novas (12/08/2026) — windows, commands, events
// ═══════════════════════════════════════════════════════════════════════════════

// ─── core.window.open ─────────────────────────────────────────────────────

describe('handlePluginMessage — core.window.open', () => {
  const WINDOW_PLUGIN_ID = 'abre-janela';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    useWindowStore.setState({ windows: [], topZIndex: 50, cascadeOffset: 0 });
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(WINDOW_PLUGIN_ID, 'windows', false);

    const ack = await handlePluginMessage(WINDOW_PLUGIN_ID, {
      type: 'core.window.open',
      requestId: 'req-win-1',
      payload: { app: 'tasks' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('aplicação desconhecida: devolve ok:false com razão', async () => {
    const ack = await handlePluginMessage(WINDOW_PLUGIN_ID, {
      type: 'core.window.open',
      requestId: 'req-win-2',
      payload: { app: 'app-que-nao-existe' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('app-desconhecida');
  });

  it('aplicação conhecida: abre a janela e devolve windowId', async () => {
    const ack = await handlePluginMessage(WINDOW_PLUGIN_ID, {
      type: 'core.window.open',
      requestId: 'req-win-3',
      payload: { app: 'tasks', titulo: 'Tarefas do plugin' },
    });

    expect(ack.ok).toBe(true);
    expect(ack.data).toBeDefined();
    const data = ack.data as { windowId: string };
    expect(typeof data.windowId).toBe('string');

    // A janela foi mesmo adicionada à store.
    const windows = useWindowStore.getState().windows;
    expect(windows).toHaveLength(1);
    expect(windows[0]?.appId).toBe('tasks');
    expect(windows[0]?.title).toBe('Tarefas do plugin');
  });

  it('aplicação não implementada (music): recusa', async () => {
    const ack = await handlePluginMessage(WINDOW_PLUGIN_ID, {
      type: 'core.window.open',
      requestId: 'req-win-4',
      payload: { app: 'music' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('app-por-implementar');
  });
});

// ─── core.command.register ────────────────────────────────────────────────

describe('handlePluginMessage — core.command.register', () => {
  const CMD_PLUGIN_ID = 'regista-comando';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    clearPluginCommands();
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(CMD_PLUGIN_ID, 'commands', false);

    const ack = await handlePluginMessage(CMD_PLUGIN_ID, {
      type: 'core.command.register',
      requestId: 'req-cmd-1',
      payload: { id: 'cmd-teste', nome: 'Teste', descricao: 'Um comando de teste.' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('regista um comando e fica disponível em getPluginCommands', async () => {
    const ack = await handlePluginMessage(CMD_PLUGIN_ID, {
      type: 'core.command.register',
      requestId: 'req-cmd-2',
      payload: { id: 'cmd-ola', nome: 'Dizer olá', descricao: 'Um comando que diz olá.' },
    });

    expect(ack.ok).toBe(true);
    const commands = getPluginCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]?.pluginId).toBe(CMD_PLUGIN_ID);
    expect(commands[0]?.id).toBe('cmd-ola');
    expect(commands[0]?.nome).toBe('Dizer olá');
  });

  it('recusa registar o mesmo ID duas vezes pelo mesmo plugin', async () => {
    const payload = { id: 'cmd-duplicado', nome: 'Duplicado', descricao: 'Teste.' };

    const primeiro = await handlePluginMessage(CMD_PLUGIN_ID, {
      type: 'core.command.register',
      requestId: 'req-cmd-3',
      payload,
    });
    expect(primeiro.ok).toBe(true);

    const segundo = await handlePluginMessage(CMD_PLUGIN_ID, {
      type: 'core.command.register',
      requestId: 'req-cmd-4',
      payload,
    });

    expect(segundo.ok).toBe(false);
    expect(segundo.reason).toBe('comando-ja-registado');
    expect(getPluginCommands()).toHaveLength(1);
  });

  it('dois plugins podem registar IDs iguais sem conflito', async () => {
    const payload = { id: 'cmd-partilhado', nome: 'Partilhado', descricao: 'Teste.' };

    await handlePluginMessage(CMD_PLUGIN_ID, {
      type: 'core.command.register',
      requestId: 'req-cmd-5',
      payload,
    });

    await handlePluginMessage('outro-plugin', {
      type: 'core.command.register',
      requestId: 'req-cmd-6',
      payload,
    });

    expect(getPluginCommands()).toHaveLength(2);
  });
});

// ─── core.event.subscribe ─────────────────────────────────────────────────

describe('handlePluginMessage — core.event.subscribe', () => {
  const EVENT_PLUGIN_ID = 'escuta-eventos';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    eventBus.clear();
  });

  afterEach(() => {
    clearPluginSubscriptions(EVENT_PLUGIN_ID);
    eventBus.clear();
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(EVENT_PLUGIN_ID, 'events', false);

    const ack = await handlePluginMessage(EVENT_PLUGIN_ID, {
      type: 'core.event.subscribe',
      requestId: 'req-ev-1',
      payload: { evento: 'tema:alterado' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('evento desconhecido: recusa', async () => {
    const ack = await handlePluginMessage(EVENT_PLUGIN_ID, {
      type: 'core.event.subscribe',
      requestId: 'req-ev-2',
      payload: { evento: 'evento:inventado' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('evento-desconhecido');
  });

  it('evento conhecido: subscreve e devolve subscriptionId', async () => {
    const ack = await handlePluginMessage(EVENT_PLUGIN_ID, {
      type: 'core.event.subscribe',
      requestId: 'req-ev-3',
      payload: { evento: 'tema:alterado' },
    });

    expect(ack.ok).toBe(true);
    const data = ack.data as { subscriptionId: string };
    expect(typeof data.subscriptionId).toBe('string');
    expect(data.subscriptionId).toContain('tema:alterado');
  });

  it('quando o evento dispara, sendToPlugin é chamado com o payload', async () => {
    const mensagens: Record<string, unknown>[] = [];

    await handlePluginMessage(
      EVENT_PLUGIN_ID,
      {
        type: 'core.event.subscribe',
        requestId: 'req-ev-4',
        payload: { evento: 'tema:alterado' },
      },
      (msg) => mensagens.push(msg),
    );

    eventBus.emit('tema:alterado', { theme: 'dark' });

    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toMatchObject({
      type: 'core.event',
      evento: 'tema:alterado',
    });
    const payload = mensagens[0]?.payload as { theme: string };
    expect(payload.theme).toBe('dark');
  });

  it('clearPluginSubscriptions remove os ouvintes todos de um plugin', async () => {
    const mensagens: Record<string, unknown>[] = [];

    await handlePluginMessage(
      EVENT_PLUGIN_ID,
      {
        type: 'core.event.subscribe',
        requestId: 'req-ev-5',
        payload: { evento: 'tema:alterado' },
      },
      (msg) => mensagens.push(msg),
    );

    clearPluginSubscriptions(EVENT_PLUGIN_ID);

    eventBus.emit('tema:alterado', { theme: 'light' });
    expect(mensagens).toHaveLength(0);
  });

  it('sem sendToPlugin, a subscrição não rebenta — simplesmente não empurra eventos', async () => {
    const ack = await handlePluginMessage(EVENT_PLUGIN_ID, {
      type: 'core.event.subscribe',
      requestId: 'req-ev-6',
      payload: { evento: 'tema:alterado' },
    });

    expect(ack.ok).toBe(true);
    // Emitir o evento não deve rebentar.
    eventBus.emit('tema:alterado', { theme: 'dark' });
  });
});
