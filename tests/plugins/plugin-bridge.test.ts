import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAllPluginShortcuts,
  clearPluginCommands,
  clearPluginMenuItems,
  clearPluginPanels,
  clearPluginServices,
  clearPluginSettings,
  clearPluginSubscriptions,
  clearPluginWidgets,
  getPluginCommands,
  getPluginMenuItems,
  getPluginPanels,
  getPluginSettingValue,
  getPluginSettings,
  getPluginShortcuts,
  getPluginWidgets,
  handlePluginMessage,
  pushToPlugin,
  registerPluginSender,
  setPluginSettingValue,
  unregisterPluginSender,
} from '@/plugins/runtime/plugin-bridge';
import { clearExternalPlugins, saveExternalPlugin } from '@/plugins/external-storage';
import type { PluginPermissions } from '@/plugins/plugin';
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
  isAbsolute: async (path: string) =>
    path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:/.test(path),
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

/** `PluginPermissions` com tudo a `false`, para semear um plugin externo nos testes. */
function perms(overrides: Partial<PluginPermissions>): PluginPermissions {
  return {
    filesystem: false,
    network: false,
    systemMetrics: false,
    notifications: false,
    shell: false,
    windows: false,
    commands: false,
    events: false,
    storage: false,
    shortcuts: false,
    widgets: false,
    menus: false,
    settings: false,
    services: false,
    panels: false,
    ...overrides,
  };
}

/** Semeia um plugin externo instalado, com as permissões dadas no manifesto. */
function seedExternalPlugin(id: string, overrides: Partial<PluginPermissions>): void {
  saveExternalPlugin({
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      description: 'Plugin externo de teste.',
      author: 'Teste',
      permissions: perms(overrides),
      platforms: ['desktop'],
    },
    signature: 'x',
    signerPublicKey: 'y',
    code: '/* vazio */',
  });
}

beforeEach(() => {
  clearExternalPlugins();
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

describe('handlePluginMessage — o manifesto é a fronteira', () => {
  it('capacidade fora do manifesto é recusada, mesmo sem revogação na interface', async () => {
    // 'ola-notificacao' declara só `notifications` — pedir storage não devia passar.
    const ack = await handlePluginMessage(PLUGIN_ID, {
      type: 'core.storage.set',
      requestId: 'decl-1',
      payload: { chave: 'x', valor: 1 },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-nao-declarada');
  });

  it('um plugin externo responde pelo próprio manifesto, não pelo catálogo', async () => {
    seedExternalPlugin('ola-ficheiro', { notifications: true });

    // 'ola-ficheiro' do catálogo tem `filesystem: true` — o externo com o mesmo
    // id declara só notificações, por isso pedir ficheiros é recusado.
    const fs = await handlePluginMessage('ola-ficheiro', {
      type: 'core.fs.write',
      requestId: 'decl-2',
      payload: { caminho: 'nota.txt', conteudo: 'x' },
    });
    expect(fs.ok).toBe(false);
    expect(fs.reason).toBe('permissao-nao-declarada');

    // A capacidade que o manifesto externo declara passa a sério.
    const notif = await handlePluginMessage('ola-ficheiro', notifyRequest('decl-3'));
    expect(notif.ok).toBe(true);
  });

  it('plugin externo não herda filesystemRoot do catálogo só por ter o mesmo id', async () => {
    seedExternalPlugin('ola-ficheiro', { filesystem: true });

    const ack = await handlePluginMessage('ola-ficheiro', {
      type: 'core.fs.write',
      requestId: 'decl-4',
      payload: { caminho: 'nota.txt', conteudo: 'x' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('sem-raiz-declarada');
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
    // 'browser' declara `network` mas não tem allowedDomains
    const ack = await handlePluginMessage('browser', {
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

  it('sem filesystemRoot declarado (automations), recusa antes de tocar no disco', async () => {
    const ack = await handlePluginMessage('automations', {
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

  it('um caminho absoluto é recusado — o join não pode substituir a pasta do plugin', async () => {
    const ack = await handlePluginMessage(FS_PLUGIN_ID, {
      type: 'core.fs.read',
      requestId: 'req-fs-6',
      payload: { caminho: '/etc/passwd' },
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

  it('um redireccionamento não é seguido — o domínio autorizado não aponta para dentro', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({ type: 'opaqueredirect', status: 0, ok: false, text: async () => '' }) as unknown as Response,
    );
    globalThis.fetch = fetchMock;

    const ack = await handlePluginMessage(NET_PLUGIN_ID, {
      type: 'core.fetch',
      requestId: 'req-net-5',
      payload: { url: 'https://jsonplaceholder.typicode.com/redirecciona' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('redireccionamento-nao-seguido');
    // A verificação do domínio é só sobre a URL inicial — sem `redirect:
    // 'manual'`, o `fetch` seguia o redireccionamento e entregava a resposta
    // de outro anfitrião (localhost/IP privado) ao plugin.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('jsonplaceholder.typicode.com'),
      expect.objectContaining({ redirect: 'manual' }),
    );
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
    seedExternalPlugin('outro-plugin', { commands: true });

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

// ═══════════════════════════════════════════════════════════════════════════════
// Armazenamento e atalhos — cobertura em falta (12/08/2026): as duas
// capacidades já corriam a sério na app, mas nunca tinham testes próprios.
// ═══════════════════════════════════════════════════════════════════════════════

describe('handlePluginMessage — core.storage', () => {
  const STORAGE_PLUGIN_ID = 'guarda-preferencias';

  beforeEach(() => {
    localStorage.clear();
    usePluginStore.setState({ deniedPermissions: {} });
  });

  it('permissão recusada: set não escreve nada', async () => {
    usePluginStore.getState().setPermission(STORAGE_PLUGIN_ID, 'storage', false);

    const ack = await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.set',
      requestId: 'st-1',
      payload: { chave: 'visitas', valor: 1 },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
    expect(localStorage.getItem('jarvis.plugins:guarda-preferencias:visitas')).toBeNull();
  });

  it('escreve e lê de volta', async () => {
    await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.set',
      requestId: 'st-2',
      payload: { chave: 'visitas', valor: 3 },
    });

    const leitura = await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.get',
      requestId: 'st-3',
      payload: { chave: 'visitas' },
    });

    expect((leitura.data as { valor: unknown }).valor).toBe(3);
  });

  it('chave nunca guardada devolve o fallback pedido', async () => {
    const ack = await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.get',
      requestId: 'st-4',
      payload: { chave: 'nunca-guardada', fallback: 'omissao' },
    });

    expect((ack.data as { valor: unknown }).valor).toBe('omissao');
  });

  it('remove apaga a chave a sério', async () => {
    await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.set',
      requestId: 'st-5',
      payload: { chave: 'temp', valor: 'x' },
    });
    await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.remove',
      requestId: 'st-6',
      payload: { chave: 'temp' },
    });

    const leitura = await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.get',
      requestId: 'st-7',
      payload: { chave: 'temp', fallback: null },
    });

    expect((leitura.data as { valor: unknown }).valor).toBeNull();
  });

  it('dois plugins com a mesma chave não se veem — o prefixo isola', async () => {
    seedExternalPlugin('outro-plugin', { storage: true });

    await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.set',
      requestId: 'st-8',
      payload: { chave: 'k', valor: 'a' },
    });
    await handlePluginMessage('outro-plugin', {
      type: 'core.storage.set',
      requestId: 'st-9',
      payload: { chave: 'k', valor: 'b' },
    });

    const leituraA = await handlePluginMessage(STORAGE_PLUGIN_ID, {
      type: 'core.storage.get',
      requestId: 'st-10',
      payload: { chave: 'k' },
    });

    expect((leituraA.data as { valor: unknown }).valor).toBe('a');
  });
});

describe('handlePluginMessage — core.shortcut.register', () => {
  const SHORTCUT_PLUGIN_ID = 'regista-atalho';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    clearAllPluginShortcuts();
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(SHORTCUT_PLUGIN_ID, 'shortcuts', false);

    const ack = await handlePluginMessage(SHORTCUT_PLUGIN_ID, {
      type: 'core.shortcut.register',
      requestId: 'sc-1',
      payload: { id: 'mostrar-hora', key: 'h', ctrlOrMeta: true, shift: true },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('regista e fica em getPluginShortcuts', async () => {
    const ack = await handlePluginMessage(SHORTCUT_PLUGIN_ID, {
      type: 'core.shortcut.register',
      requestId: 'sc-2',
      payload: { id: 'mostrar-hora', key: 'h', ctrlOrMeta: true, shift: true },
    });

    expect(ack.ok).toBe(true);
    const shortcuts = getPluginShortcuts();
    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0]).toMatchObject({ pluginId: SHORTCUT_PLUGIN_ID, id: 'mostrar-hora', key: 'h' });
  });

  it('recusa registar o mesmo ID duas vezes pelo mesmo plugin', async () => {
    const payload = { id: 'duplicado', key: 'x' };
    await handlePluginMessage(SHORTCUT_PLUGIN_ID, { type: 'core.shortcut.register', requestId: 'sc-3', payload });

    const segundo = await handlePluginMessage(SHORTCUT_PLUGIN_ID, {
      type: 'core.shortcut.register',
      requestId: 'sc-4',
      payload,
    });

    expect(segundo.ok).toBe(false);
    expect(segundo.reason).toBe('atalho-ja-registado');
  });

  it('recusa um atalho reservado do sistema (Ctrl+K)', async () => {
    const ack = await handlePluginMessage(SHORTCUT_PLUGIN_ID, {
      type: 'core.shortcut.register',
      requestId: 'sc-5',
      payload: { id: 'palete', key: 'k', ctrlOrMeta: true },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('atalho-reservado');
  });

  it('a mesma tecla sem Ctrl/Meta não é reservada', async () => {
    const ack = await handlePluginMessage(SHORTCUT_PLUGIN_ID, {
      type: 'core.shortcut.register',
      requestId: 'sc-6',
      payload: { id: 'letra-k', key: 'k', ctrlOrMeta: false },
    });

    expect(ack.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Capacidades novas (12/08/2026) — widgets, menus, definições, serviços, painéis
// ═══════════════════════════════════════════════════════════════════════════════

describe('registerPluginSender / pushToPlugin — entrega para o iframe certo', () => {
  afterEach(() => {
    unregisterPluginSender('plugin-x');
  });

  it('sem sender registado, devolve false e não rebenta', () => {
    expect(pushToPlugin('inexistente', { type: 'core.shortcut.triggered', id: 'a' })).toBe(false);
  });

  it('com sender registado, a mensagem é mesmo entregue', () => {
    const recebidas: Record<string, unknown>[] = [];
    registerPluginSender('plugin-x', (msg) => recebidas.push(msg));

    const entregue = pushToPlugin('plugin-x', { type: 'core.shortcut.triggered', id: 'a' });

    expect(entregue).toBe(true);
    expect(recebidas).toEqual([{ type: 'core.shortcut.triggered', id: 'a' }]);
  });

  it('depois de desregistado, deixa de entregar — a fuga que o bug original tinha', () => {
    registerPluginSender('plugin-x', () => {
      throw new Error('não devia ser chamado');
    });
    unregisterPluginSender('plugin-x');

    expect(pushToPlugin('plugin-x', { type: 'core.shortcut.triggered', id: 'a' })).toBe(false);
  });
});

describe('handlePluginMessage — core.widget.create', () => {
  const WIDGET_PLUGIN_ID = 'cria-widget';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    clearPluginWidgets(WIDGET_PLUGIN_ID);
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(WIDGET_PLUGIN_ID, 'widgets', false);

    const ack = await handlePluginMessage(WIDGET_PLUGIN_ID, {
      type: 'core.widget.create',
      requestId: 'w-1',
      payload: { id: 'resumo', titulo: 'T', texto: 'X' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('cria e fica disponível em getPluginWidgets', async () => {
    const ack = await handlePluginMessage(WIDGET_PLUGIN_ID, {
      type: 'core.widget.create',
      requestId: 'w-2',
      payload: { id: 'resumo', titulo: 'Resumo', texto: 'Texto do widget' },
    });

    expect(ack.ok).toBe(true);
    const widgets = getPluginWidgets(WIDGET_PLUGIN_ID);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ id: 'resumo', titulo: 'Resumo', texto: 'Texto do widget' });
  });

  it('criar com o mesmo id substitui em vez de duplicar', async () => {
    await handlePluginMessage(WIDGET_PLUGIN_ID, {
      type: 'core.widget.create',
      requestId: 'w-3',
      payload: { id: 'resumo', titulo: 'Primeiro', texto: 'A' },
    });
    await handlePluginMessage(WIDGET_PLUGIN_ID, {
      type: 'core.widget.create',
      requestId: 'w-4',
      payload: { id: 'resumo', titulo: 'Segundo', texto: 'B' },
    });

    const widgets = getPluginWidgets(WIDGET_PLUGIN_ID);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.titulo).toBe('Segundo');
  });

  it('dois plugins não se misturam', async () => {
    seedExternalPlugin('outro-plugin', { widgets: true });

    await handlePluginMessage(WIDGET_PLUGIN_ID, {
      type: 'core.widget.create',
      requestId: 'w-5',
      payload: { id: 'resumo', titulo: 'A', texto: 'A' },
    });
    await handlePluginMessage('outro-plugin', {
      type: 'core.widget.create',
      requestId: 'w-6',
      payload: { id: 'resumo', titulo: 'B', texto: 'B' },
    });

    expect(getPluginWidgets(WIDGET_PLUGIN_ID)).toHaveLength(1);
    expect(getPluginWidgets('outro-plugin')).toHaveLength(1);
    clearPluginWidgets('outro-plugin');
  });

  it('clearPluginWidgets esvazia tudo', async () => {
    await handlePluginMessage(WIDGET_PLUGIN_ID, {
      type: 'core.widget.create',
      requestId: 'w-7',
      payload: { id: 'resumo', titulo: 'A', texto: 'A' },
    });
    clearPluginWidgets(WIDGET_PLUGIN_ID);

    expect(getPluginWidgets(WIDGET_PLUGIN_ID)).toHaveLength(0);
  });
});

describe('handlePluginMessage — core.menu.add', () => {
  const MENU_PLUGIN_ID = 'adiciona-menu';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    clearPluginMenuItems(MENU_PLUGIN_ID);
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(MENU_PLUGIN_ID, 'menus', false);

    const ack = await handlePluginMessage(MENU_PLUGIN_ID, {
      type: 'core.menu.add',
      requestId: 'm-1',
      payload: { id: 'saudacao', rotulo: 'Saudação' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('adiciona e fica disponível em getPluginMenuItems, visível a todos os plugins', async () => {
    const ack = await handlePluginMessage(MENU_PLUGIN_ID, {
      type: 'core.menu.add',
      requestId: 'm-2',
      payload: { id: 'saudacao', rotulo: 'Saudação do plugin' },
    });

    expect(ack.ok).toBe(true);
    const itens = getPluginMenuItems();
    expect(itens.some((item) => item.pluginId === MENU_PLUGIN_ID && item.id === 'saudacao')).toBe(true);
  });

  it('recusa registar o mesmo ID duas vezes pelo mesmo plugin', async () => {
    const payload = { id: 'duplicado', rotulo: 'X' };
    await handlePluginMessage(MENU_PLUGIN_ID, { type: 'core.menu.add', requestId: 'm-3', payload });

    const segundo = await handlePluginMessage(MENU_PLUGIN_ID, {
      type: 'core.menu.add',
      requestId: 'm-4',
      payload,
    });

    expect(segundo.ok).toBe(false);
    expect(segundo.reason).toBe('item-ja-registado');
  });

  it('um clique (pushToPlugin) chega ao plugin certo como core.menu.triggered', async () => {
    const recebidas: Record<string, unknown>[] = [];
    registerPluginSender(MENU_PLUGIN_ID, (msg) => recebidas.push(msg));

    await handlePluginMessage(MENU_PLUGIN_ID, {
      type: 'core.menu.add',
      requestId: 'm-5',
      payload: { id: 'saudacao', rotulo: 'Saudação' },
    });

    pushToPlugin(MENU_PLUGIN_ID, { type: 'core.menu.triggered', id: 'saudacao' });

    expect(recebidas).toEqual([{ type: 'core.menu.triggered', id: 'saudacao' }]);
    unregisterPluginSender(MENU_PLUGIN_ID);
  });
});

describe('handlePluginMessage — core.setting.register', () => {
  const SETTING_PLUGIN_ID = 'regista-definicao';

  beforeEach(() => {
    localStorage.clear();
    usePluginStore.setState({ deniedPermissions: {} });
    clearPluginSettings(SETTING_PLUGIN_ID);
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(SETTING_PLUGIN_ID, 'settings', false);

    const ack = await handlePluginMessage(SETTING_PLUGIN_ID, {
      type: 'core.setting.register',
      requestId: 'set-1',
      payload: { chave: 'maiusculas', rotulo: 'Maiúsculas', tipo: 'boolean', valorOmissao: false },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('regista o schema e semeia o valor por omissão no armazenamento', async () => {
    const ack = await handlePluginMessage(SETTING_PLUGIN_ID, {
      type: 'core.setting.register',
      requestId: 'set-2',
      payload: { chave: 'maiusculas', rotulo: 'Maiúsculas', tipo: 'boolean', valorOmissao: false },
    });

    expect(ack.ok).toBe(true);
    const schema = getPluginSettings(SETTING_PLUGIN_ID);
    expect(schema).toHaveLength(1);
    expect(schema[0]).toMatchObject({ chave: 'maiusculas', tipo: 'boolean' });

    const valor = await getPluginSettingValue(SETTING_PLUGIN_ID, 'maiusculas', true);
    expect(valor).toBe(false);
  });

  it('não pisa um valor já guardado ao registar de novo — reabrir não apaga a escolha', async () => {
    await setPluginSettingValue(SETTING_PLUGIN_ID, 'maiusculas', true);

    await handlePluginMessage(SETTING_PLUGIN_ID, {
      type: 'core.setting.register',
      requestId: 'set-3',
      payload: { chave: 'maiusculas', rotulo: 'Maiúsculas', tipo: 'boolean', valorOmissao: false },
    });

    const valor = await getPluginSettingValue(SETTING_PLUGIN_ID, 'maiusculas', false);
    expect(valor).toBe(true);
  });

  it('setPluginSettingValue muda o valor a sério, lido de volta por getPluginSettingValue', async () => {
    await handlePluginMessage(SETTING_PLUGIN_ID, {
      type: 'core.setting.register',
      requestId: 'set-4',
      payload: { chave: 'maiusculas', rotulo: 'Maiúsculas', tipo: 'boolean', valorOmissao: false },
    });

    await setPluginSettingValue(SETTING_PLUGIN_ID, 'maiusculas', true);

    expect(await getPluginSettingValue(SETTING_PLUGIN_ID, 'maiusculas', false)).toBe(true);
  });
});

describe('handlePluginMessage — core.service.register', () => {
  const SERVICE_PLUGIN_ID = 'cria-servico';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    clearPluginServices(SERVICE_PLUGIN_ID);
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearPluginServices(SERVICE_PLUGIN_ID);
    vi.useRealTimers();
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(SERVICE_PLUGIN_ID, 'services', false);

    const ack = await handlePluginMessage(SERVICE_PLUGIN_ID, {
      type: 'core.service.register',
      requestId: 'sv-1',
      payload: { id: 'contador', intervalMs: 5_000 },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('um intervalo abaixo do mínimo é elevado a 5000ms', async () => {
    const ack = await handlePluginMessage(SERVICE_PLUGIN_ID, {
      type: 'core.service.register',
      requestId: 'sv-2',
      payload: { id: 'contador', intervalMs: 100 },
    });

    expect(ack.ok).toBe(true);
    expect((ack.data as { intervalMs: number }).intervalMs).toBe(5_000);
  });

  it('um intervalo NaN (não finito) cai no mínimo, não numa martelada de 0ms', async () => {
    const ack = await handlePluginMessage(SERVICE_PLUGIN_ID, {
      type: 'core.service.register',
      requestId: 'sv-7',
      payload: { id: 'contador-nan', intervalMs: Number.NaN },
    });

    expect(ack.ok).toBe(true);
    expect((ack.data as { intervalMs: number }).intervalMs).toBe(5_000);
  });

  it('empurra um tick a cada intervalo, via pushToPlugin', async () => {
    const recebidas: Record<string, unknown>[] = [];
    registerPluginSender(SERVICE_PLUGIN_ID, (msg) => recebidas.push(msg));

    await handlePluginMessage(SERVICE_PLUGIN_ID, {
      type: 'core.service.register',
      requestId: 'sv-3',
      payload: { id: 'contador', intervalMs: 5_000 },
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(recebidas).toHaveLength(1);
    expect(recebidas[0]).toEqual({ type: 'core.service.tick', id: 'contador' });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(recebidas).toHaveLength(2);

    unregisterPluginSender(SERVICE_PLUGIN_ID);
  });

  it('recusa registar o mesmo id duas vezes', async () => {
    const payload = { id: 'contador', intervalMs: 5_000 };
    await handlePluginMessage(SERVICE_PLUGIN_ID, { type: 'core.service.register', requestId: 'sv-4', payload });

    const segundo = await handlePluginMessage(SERVICE_PLUGIN_ID, {
      type: 'core.service.register',
      requestId: 'sv-5',
      payload,
    });

    expect(segundo.ok).toBe(false);
    expect(segundo.reason).toBe('servico-ja-registado');
  });

  it('clearPluginServices para o temporizador — nenhum tick depois de limpo', async () => {
    const recebidas: Record<string, unknown>[] = [];
    registerPluginSender(SERVICE_PLUGIN_ID, (msg) => recebidas.push(msg));

    await handlePluginMessage(SERVICE_PLUGIN_ID, {
      type: 'core.service.register',
      requestId: 'sv-6',
      payload: { id: 'contador', intervalMs: 5_000 },
    });

    clearPluginServices(SERVICE_PLUGIN_ID);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(recebidas).toHaveLength(0);
    unregisterPluginSender(SERVICE_PLUGIN_ID);
  });
});

describe('handlePluginMessage — core.panel.add', () => {
  const PANEL_PLUGIN_ID = 'adiciona-painel';

  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    clearPluginPanels(PANEL_PLUGIN_ID);
  });

  it('permissão recusada: devolve ok:false', async () => {
    usePluginStore.getState().setPermission(PANEL_PLUGIN_ID, 'panels', false);

    const ack = await handlePluginMessage(PANEL_PLUGIN_ID, {
      type: 'core.panel.add',
      requestId: 'p-1',
      payload: { id: 'detalhes', titulo: 'Detalhes', texto: 'Texto longo' },
    });

    expect(ack.ok).toBe(false);
    expect(ack.reason).toBe('permissao-negada');
  });

  it('adiciona e fica disponível em getPluginPanels', async () => {
    const ack = await handlePluginMessage(PANEL_PLUGIN_ID, {
      type: 'core.panel.add',
      requestId: 'p-2',
      payload: { id: 'detalhes', titulo: 'Detalhes', texto: 'Texto longo' },
    });

    expect(ack.ok).toBe(true);
    const paineis = getPluginPanels(PANEL_PLUGIN_ID);
    expect(paineis).toHaveLength(1);
    expect(paineis[0]).toMatchObject({ id: 'detalhes', titulo: 'Detalhes' });
  });

  it('adicionar com o mesmo id substitui em vez de duplicar', async () => {
    await handlePluginMessage(PANEL_PLUGIN_ID, {
      type: 'core.panel.add',
      requestId: 'p-3',
      payload: { id: 'detalhes', titulo: 'Primeiro', texto: 'A' },
    });
    await handlePluginMessage(PANEL_PLUGIN_ID, {
      type: 'core.panel.add',
      requestId: 'p-4',
      payload: { id: 'detalhes', titulo: 'Segundo', texto: 'B' },
    });

    expect(getPluginPanels(PANEL_PLUGIN_ID)).toHaveLength(1);
    expect(getPluginPanels(PANEL_PLUGIN_ID)[0]?.titulo).toBe('Segundo');
  });
});
