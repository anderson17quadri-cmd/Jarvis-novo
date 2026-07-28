import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import EmailsWindow from '@/apps/emails/EmailsWindow';
import { mailService } from '@/services/mail/mail-service';

beforeEach(async () => {
  await mailService.refresh();
});

/** Espera pela primeira leitura antes de olhar para a lista. */
async function renderMailbox(): Promise<void> {
  render(<EmailsWindow />);
  await waitFor(() => expect(screen.queryByText(/a ler a caixa/i)).toBeNull());
}

describe('janela de Emails', () => {
  it('mostra a caixa de entrada e não as outras pastas', async () => {
    await renderMailbox();

    expect(screen.getByText('Pedido de demonstração do Agendado')).toBeInTheDocument();
    // Esta está em "Enviados".
    expect(screen.queryByText('Re: Orçamento de hardware atualizado')).toBeNull();
  });

  it('trocar de pasta mostra o que lá está', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByRole('button', { name: /enviados/i }));

    expect(screen.getByText('Re: Orçamento de hardware atualizado')).toBeInTheDocument();
    expect(screen.queryByText('Pedido de demonstração do Agendado')).toBeNull();
  });

  it('abrir uma mensagem mostra o corpo e marca-a como lida', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByText('Pedido de demonstração do Agendado'));

    expect(screen.getByText(/duas cadeiras e cerca de quarenta marcações/i)).toBeInTheDocument();
    await waitFor(() => {
      const message = mailService.current?.messages.find((item) => item.id === 'm1');
      expect(message?.isRead).toBe(true);
    });
  });

  it('voltar da leitura devolve a lista', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByText('Reunião de acompanhamento'));
    await user.click(screen.getByRole('button', { name: /voltar/i }));

    expect(screen.getByText('Pedido de demonstração do Agendado')).toBeInTheDocument();
  });

  it('a pesquisa ignora acentos e olha para o remetente', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.type(screen.getByRole('searchbox'), 'demonstracao');
    expect(screen.getByText('Pedido de demonstração do Agendado')).toBeInTheDocument();
    expect(screen.queryByText('Pagamento processado com sucesso')).toBeNull();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'stripe');
    expect(screen.getByText('Pagamento processado com sucesso')).toBeInTheDocument();
  });

  it('sem correspondência, explica-se', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.type(screen.getByRole('searchbox'), 'zzzzzz');
    expect(screen.getByText(/nenhuma mensagem corresponde/i)).toBeInTheDocument();
  });

  it('o favorito vai ao provedor e volta', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    const before = mailService.current?.messages.find((item) => item.id === 'm2')?.isStarred;
    const row = screen.getByText('Pagamento processado com sucesso').closest('li');
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole('button', { name: /favorito/i }));

    await waitFor(() => {
      const after = mailService.current?.messages.find((item) => item.id === 'm2')?.isStarred;
      expect(after).toBe(!before);
    });
  });

  it('diz que a caixa é simulada, em vez de deixar acreditar', async () => {
    await renderMailbox();
    expect(screen.getByText(/caixa simulada/i)).toBeInTheDocument();
  });
});
