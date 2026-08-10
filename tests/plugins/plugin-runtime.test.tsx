import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PluginRuntime } from '@/plugins/runtime/PluginRuntime';

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
