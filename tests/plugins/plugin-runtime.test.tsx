import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PluginRuntime } from '@/plugins/runtime/PluginRuntime';
import {
  clearPluginMenuItems,
  clearPluginPanels,
  clearPluginServices,
  clearPluginSettings,
  clearPluginShortcuts,
  clearPluginSubscriptions,
  clearPluginWidgets,
  getPluginMenuItems,
  getPluginPanels,
  getPluginServiceCount,
  getPluginSettings,
  getPluginShortcuts,
  getPluginWidgets,
  handlePluginMessage,
} from '@/plugins/runtime/plugin-bridge';
import { eventBus } from '@/services/event-bus';
import { usePluginStore } from '@/stores/use-plugin-store';

/**
 * O que se testa aqui sem DOM real de iframe (jsdom não corre o `srcDoc`
 * dentro do iframe): a sandbox pedida é exatamente a restrita — sem
 * `allow-same-origin`, nunca — e que o gatilho está lá. A troca de
 * mensagens a sério fica confirmada na app a correr, por CDP, não aqui.
 */
describe('PluginRuntime — sandbox do iframe', () => {
  it('pede "allow-scripts" e nada mais — nunca allow-same-origin', () => {
    const { container } = render(
      <PluginRuntime pluginId="ola-notificacao" source="/* plugin */" triggerLabel="Pedir" />,
    );

    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  it('injeta o código do plugin no srcDoc', () => {
    const { container } = render(
      <PluginRuntime
        pluginId="ola-notificacao"
        source="window.marcador12345()"
        triggerLabel="Pedir"
      />,
    );

    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain(
      'marcador12345',
    );
  });

  it('mostra o botão com o rótulo pedido', () => {
    render(<PluginRuntime pluginId="ola-notificacao" source="" triggerLabel="Pedir notificação" />);

    expect(screen.getByRole('button', { name: 'Pedir notificação' })).toBeInTheDocument();
  });
});

describe('PluginRuntime — limpeza ao desmontar', () => {
  // Os registos vivem no módulo da ponte, partilhados entre testes — cada
  // teste precisa de os encontrar vazios ao começar.
  beforeEach(() => {
    usePluginStore.setState({ deniedPermissions: {} });
    localStorage.clear();
    eventBus.clear();
    clearPluginSubscriptions('escuta-eventos');
    clearPluginShortcuts('regista-atalho');
    clearPluginWidgets('cria-widget');
    clearPluginSettings('regista-definicao');
    clearPluginServices('cria-servico');
    clearPluginPanels('adiciona-painel');
    clearPluginMenuItems('adiciona-menu');
  });

  it('cancela as subscrições de eventos do plugin quando ele deixa de correr', async () => {
    const { unmount } = render(
      <PluginRuntime pluginId="escuta-eventos" source="/* plugin */" triggerLabel="Pedir" />,
    );

    const recebidas: Record<string, unknown>[] = [];
    await handlePluginMessage(
      'escuta-eventos',
      { type: 'core.event.subscribe', requestId: 'sub-1', payload: { evento: 'tema:alterado' } },
      (mensagem) => recebidas.push(mensagem),
    );

    eventBus.emit('tema:alterado', { theme: 'escuro' });
    expect(recebidas).toHaveLength(1);

    unmount();

    eventBus.emit('tema:alterado', { theme: 'claro' });
    expect(recebidas).toHaveLength(1);
  });

  it('tira os atalhos do plugin quando ele deixa de correr', async () => {
    const { unmount } = render(
      <PluginRuntime pluginId="regista-atalho" source="/* plugin */" triggerLabel="Pedir" />,
    );

    await handlePluginMessage('regista-atalho', {
      type: 'core.shortcut.register',
      requestId: 'atalho-1',
      payload: { id: 'mostrar-hora', key: 'h', ctrlOrMeta: true, shift: true },
    });
    expect(getPluginShortcuts().some((atalho) => atalho.id === 'mostrar-hora')).toBe(true);

    unmount();

    expect(getPluginShortcuts().some((atalho) => atalho.id === 'mostrar-hora')).toBe(false);
  });

  it('tira os widgets do plugin quando ele deixa de correr', async () => {
    const { unmount } = render(
      <PluginRuntime pluginId="cria-widget" source="/* plugin */" triggerLabel="Pedir" />,
    );

    await handlePluginMessage('cria-widget', {
      type: 'core.widget.create',
      requestId: 'widget-1',
      payload: { id: 'resumo', titulo: 'Resumo', texto: 'Texto do widget' },
    });
    expect(getPluginWidgets('cria-widget')).toHaveLength(1);

    unmount();

    expect(getPluginWidgets('cria-widget')).toHaveLength(0);
  });

  it('tira as definições do plugin quando ele deixa de correr', async () => {
    const { unmount } = render(
      <PluginRuntime pluginId="regista-definicao" source="/* plugin */" triggerLabel="Pedir" />,
    );

    await handlePluginMessage('regista-definicao', {
      type: 'core.setting.register',
      requestId: 'definicao-1',
      payload: { chave: 'maiusculas', rotulo: 'Avisar em maiúsculas', tipo: 'boolean', valorOmissao: false },
    });
    expect(getPluginSettings('regista-definicao')).toHaveLength(1);

    unmount();

    expect(getPluginSettings('regista-definicao')).toHaveLength(0);
  });

  it('para os serviços em segundo plano do plugin quando ele deixa de correr', async () => {
    // Sem temporadores falsos, um serviço cuja limpeza falhasse ficava com o
    // intervalo a correr para sempre.
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        <PluginRuntime pluginId="cria-servico" source="/* plugin */" triggerLabel="Pedir" />,
      );

      await handlePluginMessage('cria-servico', {
        type: 'core.service.register',
        requestId: 'servico-1',
        payload: { id: 'contador', intervalMs: 5_000 },
      });
      expect(getPluginServiceCount('cria-servico')).toBe(1);

      unmount();

      expect(getPluginServiceCount('cria-servico')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tira os painéis do plugin quando ele deixa de correr', async () => {
    const { unmount } = render(
      <PluginRuntime pluginId="adiciona-painel" source="/* plugin */" triggerLabel="Pedir" />,
    );

    await handlePluginMessage('adiciona-painel', {
      type: 'core.panel.add',
      requestId: 'painel-1',
      payload: { id: 'detalhes', titulo: 'Detalhes', texto: 'Texto mais longo do que cabe num widget' },
    });
    expect(getPluginPanels('adiciona-painel')).toHaveLength(1);

    unmount();

    expect(getPluginPanels('adiciona-painel')).toHaveLength(0);
  });

  /**
   * Um plugin que deixa de correr não pode deixar rasto na interface. Todas as
   * outras coisas que um plugin regista (widgets, painéis, atalhos, serviços,
   * subscrições) são limpas no `return` do efeito; os itens de menu não eram —
   * `clearPluginMenuItems` existia, dizia no comentário "chamado ao desmontar",
   * e só era chamado por um teste. O resultado era um item morto no menu do
   * ambiente de trabalho, de um plugin que já não corre, que ao ser clicado não
   * faz nada (o `pushToPlugin` não encontra ninguém).
   */
  it('tira os itens de menu do plugin quando ele deixa de correr', async () => {
    const { unmount } = render(
      <PluginRuntime pluginId="adiciona-menu" source="/* plugin */" triggerLabel="Pedir" />,
    );

    await handlePluginMessage('adiciona-menu', {
      type: 'core.menu.add',
      requestId: 'menu-1',
      payload: { id: 'item-teste', rotulo: 'Item de teste' },
    });
    expect(getPluginMenuItems().some((item) => item.id === 'item-teste')).toBe(true);

    unmount();

    expect(getPluginMenuItems().some((item) => item.id === 'item-teste')).toBe(false);
  });
});
