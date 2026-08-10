import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationEditor } from '@/apps/automations/AutomationEditor';
import { aiService } from '@/services/ai-service';

/**
 * Criação de automação por linguagem natural (Parte 11-adjacente, editor
 * visual). `generateFromNL` chamava `aiService.send()` e, em qualquer
 * falha (resposta vazia, sem JSON, exceção), voltava em silêncio — sem
 * nada visível para quem clicou "Interpretar". Testado ao vivo com a app a
 * correr: o caminho de sucesso funciona (confirmado com Ollama real), mas
 * o de falha ficava mudo. Estes testes cobrem os dois.
 */

vi.mock('@/services/ai-service', () => ({
  aiService: { send: vi.fn() },
}));

const noop = (): void => {};

async function preencherEInterpretar(texto: string): Promise<void> {
  const user = userEvent.setup();
  const campo = screen.getByLabelText('Descrever automação em português');
  await user.type(campo, texto);
  await user.click(screen.getByRole('button', { name: 'Interpretar' }));
}

beforeEach(() => {
  vi.mocked(aiService.send).mockReset();
});

describe('AutomationEditor — geração por linguagem natural', () => {
  it('sucesso: preenche nome e descrição, sem mensagem de erro', async () => {
    vi.mocked(aiService.send).mockResolvedValue(
      '{"nome":"Resumo Emails","descricao":"Resume emails não lidos às 9h","quando":{"kind":"hora","hour":9,"minute":0},"se":[],"entao":[{"kind":"notificar","title":"Resumo","description":"emails"}]}',
    );
    render(<AutomationEditor onClose={noop} onSaved={noop} />);

    await preencherEInterpretar('todos os dias às 9h, resume os emails não lidos');

    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Resumo Emails'));
    expect(screen.getByLabelText('Descrição')).toHaveValue('Resume emails não lidos às 9h');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('resposta vazia: mostra erro em vez de ficar em silêncio', async () => {
    vi.mocked(aiService.send).mockResolvedValue('');
    render(<AutomationEditor onClose={noop} onSaved={noop} />);

    await preencherEInterpretar('qualquer coisa');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não respondeu nada/i);
  });

  it('resposta sem JSON: mostra erro com o que o assistente disse', async () => {
    vi.mocked(aiService.send).mockResolvedValue('Desculpe, não percebi o que quer.');
    render(<AutomationEditor onClose={noop} onSaved={noop} />);

    await preencherEInterpretar('faz uma coisa impossível');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/não consegui perceber/i);
    expect(alerta).toHaveTextContent(/não percebi o que quer/i);
  });

  it('exceção (ex.: rede em baixo): mostra a mensagem do erro', async () => {
    vi.mocked(aiService.send).mockRejectedValue(new Error('falha de rede'));
    render(<AutomationEditor onClose={noop} onSaved={noop} />);

    await preencherEInterpretar('qualquer coisa');

    expect(await screen.findByRole('alert')).toHaveTextContent(/falha de rede/i);
  });

  it('um novo pedido limpa o erro anterior', async () => {
    vi.mocked(aiService.send).mockResolvedValueOnce('');
    render(<AutomationEditor onClose={noop} onSaved={noop} />);

    await preencherEInterpretar('primeiro pedido');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    vi.mocked(aiService.send).mockResolvedValueOnce(
      '{"nome":"Ok","descricao":"","quando":{"kind":"manual"},"se":[],"entao":[]}',
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Interpretar' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
