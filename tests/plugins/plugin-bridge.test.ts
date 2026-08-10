import { beforeEach, describe, expect, it } from 'vitest';

import { handlePluginMessage } from '@/plugins/runtime/plugin-bridge';
import { logService } from '@/services/log-service';
import { useNotificationStore } from '@/stores/use-notification-store';
import { usePluginStore } from '@/stores/use-plugin-store';

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
