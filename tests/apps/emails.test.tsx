import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EmailsWindow from '@/apps/emails/EmailsWindow';
import { mailService } from '@/services/mail/mail-service';
import type * as AttachmentsModule from '@/platform/attachments';

/**
 * Sem Tauri (jsdom, tal como no browser), `pickAttachmentsNative` já
 * devolve `null` sozinho — mas fá-lo tentando primeiro importar o plugin
 * `dialog` a sério, o que é lento e depende de como esse módulo reage fora
 * do Tauri. Forçar `null` aqui torna o teste do caminho de recurso
 * (`<input type="file">`) determinístico, sem mudar o que se testa.
 */
vi.mock('@/platform/attachments', async (importOriginal) => {
  const actual = await importOriginal<typeof AttachmentsModule>();
  return { ...actual, pickAttachmentsNative: vi.fn().mockResolvedValue(null) };
});

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

describe('escrever uma mensagem — anexos', () => {
  it('anexar um ficheiro mostra nome e tamanho', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByRole('button', { name: /nova mensagem/i }));
    await user.click(screen.getByRole('button', { name: /^anexar$/i }));

    const file = new File(['conteúdo do contrato'], 'contrato.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(await screen.findByText('contrato.pdf')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${file.size} B`))).toBeInTheDocument();
  });

  it('uma imagem ganha pré-visualização; outro tipo não', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByRole('button', { name: /nova mensagem/i }));
    await user.click(screen.getByRole('button', { name: /^anexar$/i }));

    const image = new File(['fake-png'], 'foto.png', { type: 'image/png' });
    const doc = new File(['texto'], 'notas.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [image, doc]);

    await screen.findByText('foto.png');
    const imagemItem = screen.getByText('foto.png').closest('li');
    const docItem = screen.getByText('notas.txt').closest('li');

    expect(within(imagemItem!).getByRole('img')).toBeInTheDocument();
    expect(within(docItem!).queryByRole('img')).toBeNull();
  });

  it('remover um anexo tira-o da lista', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByRole('button', { name: /nova mensagem/i }));
    await user.click(screen.getByRole('button', { name: /^anexar$/i }));

    const file = new File(['x'], 'ficheiro.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await screen.findByText('ficheiro.txt');

    await user.click(screen.getByRole('button', { name: /remover anexo ficheiro\.txt/i }));

    expect(screen.queryByText('ficheiro.txt')).toBeNull();
  });

  it('enviar continua desligado — diz-se, em vez de fingir', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByRole('button', { name: /nova mensagem/i }));

    expect(screen.getByRole('button', { name: /^enviar$/i })).toBeDisabled();
    expect(screen.getByText(/enviar exige um provedor de envio real/i)).toBeInTheDocument();
  });

  it('cancelar volta à lista sem guardar nada', async () => {
    const user = userEvent.setup();
    await renderMailbox();

    await user.click(screen.getByRole('button', { name: /nova mensagem/i }));
    await user.type(screen.getByLabelText('Assunto'), 'Rascunho de teste');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByText('Pedido de demonstração do Agendado')).toBeInTheDocument();
    expect(screen.queryByText('Rascunho de teste')).toBeNull();
  });

  it('cancelar com uma imagem anexada revoga a pré-visualização — sem isto, a blob URL fica viva para sempre', async () => {
    const user = userEvent.setup();
    await renderMailbox();
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    await user.click(screen.getByRole('button', { name: /nova mensagem/i }));
    await user.click(screen.getByRole('button', { name: /^anexar$/i }));
    const image = new File(['fake-png'], 'foto.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, image);
    const preview = await screen.findByAltText<HTMLImageElement>('foto.png');
    const previewUrl = preview.src;

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
    revokeSpy.mockRestore();
  });
});
