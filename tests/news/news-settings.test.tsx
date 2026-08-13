import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewsSettings } from '@/apps/personalization/NewsSettings';
import { applyNewsSettings } from '@/hooks/use-news-settings';
import { MockNewsProvider } from '@/services/news/providers/news-provider';
import { newsService } from '@/services/news/news-service';
import { useNewsSettingsStore } from '@/stores/use-news-settings-store';
import { DEFAULT_NEWS_SETTINGS } from '@/types/news-settings';

const KEY = '0123456789abcdef0123456789abcdef';

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  useNewsSettingsStore.setState({ settings: DEFAULT_NEWS_SETTINGS });
  newsService.setProvider(new MockNewsProvider());

  // O NewsApiProvider dispara uma leitura ao ser ligado; sem rede nos testes,
  // faz-se o pedido falhar de forma controlada.
  global.fetch = vi.fn(() => Promise.reject(new Error('sem rede no teste')));
});

afterEach(() => {
  global.fetch = originalFetch;
  newsService.setProvider(new MockNewsProvider());
});

describe('escolha do provedor', () => {
  it('por omissão fica no simulado — nada sai sem ser pedido', () => {
    applyNewsSettings(DEFAULT_NEWS_SETTINGS);

    expect(newsService.providerName).toBe('Simulado');
  });

  it('com chave passa à NewsAPI', () => {
    applyNewsSettings({ apiKey: KEY, country: 'pt' });

    expect(newsService.providerName).toBe('NewsAPI');
  });

  it('sem chave mantém o simulado', () => {
    applyNewsSettings({ apiKey: '  ', country: 'pt' });

    expect(newsService.providerName).toBe('Simulado');
  });
});

describe('a interface', () => {
  it('guardar uma chave liga a NewsAPI', async () => {
    const user = userEvent.setup();
    render(<NewsSettings />);

    await user.type(screen.getByLabelText('Chave da NewsAPI'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(newsService.providerName).toBe('NewsAPI');
    });
  });

  it('avisa o que sai do dispositivo e para onde', () => {
    render(<NewsSettings />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/saem deste dispositivo/i);
    expect(note).toHaveTextContent('https://newsapi.org/v2/top-headlines');
    expect(note).toHaveTextContent(/cofre do sistema/i);
  });

  it('depois de guardada, mostra-se tapada', async () => {
    const user = userEvent.setup();
    render(<NewsSettings />);
    await user.type(screen.getByLabelText('Chave da NewsAPI'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    expect(await screen.findByText(/012345…cdef/)).toBeInTheDocument();
    expect(screen.queryByText(KEY)).toBeNull();
  });

  it('apagar a chave volta ao simulado', async () => {
    const user = userEvent.setup();
    render(<NewsSettings />);
    await user.type(screen.getByLabelText('Chave da NewsAPI'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await user.click(await screen.findByLabelText('Apagar a chave'));

    expect(useNewsSettingsStore.getState().settings.apiKey).toBe('');
    expect(newsService.providerName).toBe('Simulado');
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar e o provedor volta a ser ligado', async () => {
    useNewsSettingsStore.getState().setApiKey(KEY);
    useNewsSettingsStore.getState().setCountry('br');
    await useNewsSettingsStore.getState().persist();

    useNewsSettingsStore.setState({ settings: DEFAULT_NEWS_SETTINGS });
    await useNewsSettingsStore.getState().hydrate();
    applyNewsSettings(useNewsSettingsStore.getState().settings);

    expect(useNewsSettingsStore.getState().settings.apiKey).toBe(KEY);
    expect(useNewsSettingsStore.getState().settings.country).toBe('br');
    expect(newsService.providerName).toBe('NewsAPI');
  });

  it('sem nada gravado, arranca no simulado', async () => {
    await useNewsSettingsStore.getState().hydrate();
    applyNewsSettings(useNewsSettingsStore.getState().settings);

    expect(useNewsSettingsStore.getState().settings.apiKey).toBe('');
    expect(newsService.providerName).toBe('Simulado');
  });
});
