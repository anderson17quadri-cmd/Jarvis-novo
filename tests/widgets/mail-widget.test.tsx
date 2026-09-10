import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MailWidget from '@/widgets/mail/MailWidget';
import { mailService } from '@/services/mail/mail-service';
import { MockMailProvider, type MailProvider } from '@/services/mail/providers/mail-provider';
import { notificationService } from '@/services/notification-service';
import { useMailStore } from '@/stores/use-mail-store';

class FailingMailProvider implements MailProvider {
  readonly id = 'failing';
  readonly name = 'Falha';
  isConfigured(): boolean {
    return true;
  }
  fetch(): Promise<never> {
    return Promise.reject(new Error('sem rede'));
  }
  markRead(): Promise<void> {
    return Promise.reject(new Error('sem rede'));
  }
  toggleStar(): Promise<void> {
    return Promise.reject(new Error('sem rede'));
  }
  send(): Promise<void> {
    return Promise.reject(new Error('sem rede'));
  }
}

beforeEach(() => {
  useMailStore.setState({ snapshot: null, isLoading: true, error: null });
});

afterEach(() => {
  mailService.setProvider(new MockMailProvider());
});

describe('widget de Email — erro de rede não fica em silêncio', () => {
  it('sem nenhuma leitura boa ainda, uma falha mostra o estado de erro', async () => {
    mailService.setProvider(new FailingMailProvider());

    render(<MailWidget />);

    expect(await screen.findByText('Não consegui ler o correio.')).toBeInTheDocument();
  });

  it('marcar como lida falhada avisa, em vez de a mensagem parecer intocada sem explicação', async () => {
    mailService.setProvider(new FailingMailProvider());
    const spy = vi.spyOn(notificationService, 'error').mockImplementation(() => 'id');

    await expect(useMailStore.getState().markRead('m1')).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Não consegui'), expect.any(String));
  });
});
