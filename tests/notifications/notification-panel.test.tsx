import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { useNotificationStore } from '@/stores/use-notification-store';

beforeEach(() => {
  localStorage.clear();
  useNotificationStore.setState({ notifications: [], isPanelOpen: true });
});

/**
 * A pesquisa do painel é o histórico de voz pesquisável (Parte 7.2): todo
 * comando reconhecido gera uma notificação com o transcrito no título e a
 * categoria "assistente" (`use-voice.ts`), e é este campo que a filtra.
 */
describe('NotificationPanel', () => {
  it('pesquisa encontra pelo transcrito de um comando de voz', async () => {
    const user = userEvent.setup();
    useNotificationStore
      .getState()
      .push('"abrir o email"', 'Abrir a janela Email', { category: 'assistente' });
    useNotificationStore
      .getState()
      .push('Backup concluído', 'Cópia de segurança guardada', { category: 'sistema' });

    render(<NotificationPanel />);

    await user.type(screen.getByLabelText('Pesquisar notificações'), 'email');

    expect(screen.getByText('"abrir o email"')).toBeInTheDocument();
    expect(screen.queryByText('Backup concluído')).toBeNull();
  });

  it('pesquisa sem acentos nem maiúsculas encontra na mesma', async () => {
    const user = userEvent.setup();
    useNotificationStore
      .getState()
      .push('"mudar para o modo economia"', 'Passar ao modo Economia', {
        category: 'assistente',
      });

    render(<NotificationPanel />);

    await user.type(screen.getByLabelText('Pesquisar notificações'), 'ECONOMIA');

    expect(screen.getByText('"mudar para o modo economia"')).toBeInTheDocument();
  });

  it('filtro por categoria "Assistente" isola o histórico de voz', async () => {
    const user = userEvent.setup();
    useNotificationStore
      .getState()
      .push('"que horas são"', 'São 14:30', { category: 'assistente' });
    useNotificationStore.getState().push('Nova mensagem', 'Chegou um email', { category: 'email' });

    render(<NotificationPanel />);

    await user.click(screen.getByRole('button', { name: 'Assistente' }));

    expect(screen.getByText('"que horas são"')).toBeInTheDocument();
    expect(screen.queryByText('Nova mensagem')).toBeNull();
  });

  it('pesquisa sem correspondência mostra o aviso, não uma lista vazia muda', async () => {
    const user = userEvent.setup();
    useNotificationStore.getState().push('"abrir o email"', 'Abrir a janela Email', {
      category: 'assistente',
    });

    render(<NotificationPanel />);

    await user.type(screen.getByLabelText('Pesquisar notificações'), 'xyzxyz');

    expect(screen.getByText('Nenhuma notificação corresponde à pesquisa.')).toBeInTheDocument();
  });
});
