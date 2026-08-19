import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PluginRuntime } from '@/plugins/runtime/PluginRuntime';
import { getPluginMenuItems, handlePluginMessage } from '@/plugins/runtime/plugin-bridge';

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
