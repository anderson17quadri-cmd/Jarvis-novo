import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import AssistantWindow from '@/apps/assistant/AssistantWindow';
import { setContextSource } from '@/services/assistant/context';
import { memoryService } from '@/services/assistant/memory-service';
import { selectMessages, useAssistantStore } from '@/stores/use-assistant-store';
import type { AssistantContext } from '@/types/assistant';

function context(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    now: new Date(2026, 6, 28, 9, 0),
    userName: 'Anderson',
    weather: null,
    openWindows: [],
    unreadNotifications: 0,
    systemState: 'normal',
    theme: 'classic',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  memoryService.clear();
  useAssistantStore.getState().reset();
});

describe('abertura', () => {
  it('cumprimenta com o que sabe, não com factos inventados', async () => {
    const stop = setContextSource(() => context({ unreadNotifications: 2 }));
    render(<AssistantWindow />);

    expect(await screen.findByText(/Bom dia, Anderson\./)).toBeInTheDocument();
    expect(screen.getByText(/2 notificações por ler/)).toBeInTheDocument();
    stop();
  });

  it('sem nada pendente diz que está tudo calmo', async () => {
    const stop = setContextSource(() => context());
    render(<AssistantWindow />);

    expect(await screen.findByText(/Está tudo calmo/)).toBeInTheDocument();
    stop();
  });

  it('reabrir não repete o cumprimento', async () => {
    const stop = setContextSource(() => context());
    const { unmount } = render(<AssistantWindow />);
    await screen.findByText(/Bom dia/);
    unmount();

    render(<AssistantWindow />);
    await waitFor(() => {
      expect(selectMessages(useAssistantStore.getState())).toHaveLength(1);
    });
    stop();
  });
});

describe('enviar', () => {
  it('escrever e carregar em Enter põe o pedido na conversa', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    await user.type(screen.getByLabelText('Comando para o assistente'), 'que horas são{Enter}');

    const log = screen.getByRole('log', { name: 'Conversa' });
    expect(await within(log).findByText('que horas são')).toBeInTheDocument();
  });

  it('uma linha vazia não envia nada', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);
    const before = selectMessages(useAssistantStore.getState()).length;

    await user.type(screen.getByLabelText('Comando para o assistente'), '   {Enter}');

    expect(selectMessages(useAssistantStore.getState())).toHaveLength(before);
  });
});

describe('histórico', () => {
  it('o botão abre e fecha o painel', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    const toggle = screen.getByLabelText('Histórico de conversas');
    await user.click(toggle);
    expect(screen.getByRole('tab', { name: /Conversas/ })).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByRole('tab', { name: /Conversas/ })).toBeNull();
  });

  it('uma conversa nova deixa a anterior no histórico', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    await user.type(screen.getByLabelText('Comando para o assistente'), 'abre os emails{Enter}');
    // O título da conversa passa a ser o pedido, por isso o texto aparece duas
    // vezes: no cabeçalho e na conversa. Aqui interessa o da conversa.
    await within(screen.getByRole('log', { name: 'Conversa' })).findByText('abre os emails');

    await user.click(screen.getByLabelText('Nova conversa'));
    await user.click(screen.getByLabelText('Histórico de conversas'));

    const panel = screen.getByRole('region', { name: 'Conversas guardadas' });
    expect(await within(panel).findByText('abre os emails')).toBeInTheDocument();
    // E a conversa aberta é a nova, vazia.
    expect(within(screen.getByRole('log', { name: 'Conversa' })).queryByText('abre os emails')).toBeNull();
  });

  it('a memória mostra o que foi guardado, e deixa esquecê-lo', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    await user.type(
      screen.getByLabelText('Comando para o assistente'),
      'trata-me por Quadri{Enter}',
    );

    await user.click(screen.getByLabelText('Histórico de conversas'));
    await user.click(screen.getByRole('tab', { name: /Memória/ }));

    // A etiqueta identifica a preferência guardada; o valor também aparece na
    // lista de últimos pedidos, que é outra coisa.
    expect(await screen.findByText(/Trata-te por/)).toBeInTheDocument();
    expect(screen.getAllByText(/Quadri/).length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText('Esquecer nome'));
    expect(screen.getByText(/Nada, para já/)).toBeInTheDocument();
  });

  it('a memória diz onde fica guardada', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    await user.click(screen.getByLabelText('Histórico de conversas'));
    await user.click(screen.getByRole('tab', { name: /Memória/ }));

    expect(screen.getByText(/Fica no dispositivo/)).toBeInTheDocument();
  });
});

describe('favoritas e regenerar', () => {
  it('marcar uma mensagem como favorita', async () => {
    const stop = setContextSource(() => context());
    const user = userEvent.setup();
    render(<AssistantWindow />);

    const greeting = await screen.findByText(/Bom dia/);
    const article = greeting.closest('article');
    expect(article).not.toBeNull();

    await user.click(within(article!).getByLabelText('Marcar como favorita'));

    expect(selectMessages(useAssistantStore.getState())[0]?.isFavourite).toBe(true);
    stop();
  });

  it('só a última resposta oferece gerar outra', async () => {
    const stop = setContextSource(() => context());
    render(<AssistantWindow />);
    await screen.findByText(/Bom dia/);

    // Uma resposta sozinha é a última — o botão existe.
    expect(screen.getByLabelText('Gerar outra resposta')).toBeInTheDocument();

    act(() => {
      useAssistantStore.getState().addMessage('user', 'e agora');
    });
    await waitFor(() => {
      // Com um pedido depois dela, já não é a última.
      expect(screen.queryByLabelText('Gerar outra resposta')).toBeNull();
    });
    stop();
  });
});
