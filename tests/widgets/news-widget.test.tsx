import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NewsWidget from '@/widgets/news/NewsWidget';
import { newsService } from '@/services/news/news-service';
import { MockNewsProvider, type NewsProvider } from '@/services/news/providers/news-provider';
import { notificationService } from '@/services/notification-service';
import { useNewsStore } from '@/stores/use-news-store';

class FailingNewsProvider implements NewsProvider {
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
  toggleFavorite(): Promise<void> {
    return Promise.reject(new Error('sem rede'));
  }
}

beforeEach(() => {
  useNewsStore.setState({ snapshot: null, isLoading: true, error: null });
});

afterEach(() => {
  newsService.setProvider(new MockNewsProvider());
});

describe('widget de Notícias — erro de rede não fica em silêncio', () => {
  it('sem nenhuma leitura boa ainda, uma falha mostra o estado de erro', async () => {
    newsService.setProvider(new FailingNewsProvider());

    render(<NewsWidget />);

    expect(await screen.findByText('Não consegui obter as notícias.')).toBeInTheDocument();
  });

  it('marcar como favorito falhado avisa, em vez de desaparecer sem explicação', async () => {
    newsService.setProvider(new FailingNewsProvider());
    const spy = vi.spyOn(notificationService, 'error').mockImplementation(() => 'id');

    await expect(useNewsStore.getState().markRead('n1')).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Não consegui'),
      expect.any(String),
    );
  });
});
