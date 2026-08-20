import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchSettings } from '@/apps/personalization/SearchSettings';
import { applyWebSearchSettings } from '@/hooks/use-web-search-settings';
import { MockWebSearchProvider } from '@/services/web-search/providers/web-search-provider';
import { webSearchService } from '@/services/web-search/web-search-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { useWebSearchSettingsStore } from '@/stores/use-web-search-settings-store';
import { DEFAULT_WEB_SEARCH_SETTINGS } from '@/types/web-search-settings';

const KEY = '0123456789abcdef0123456789abcdef';

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  useWebSearchSettingsStore.setState({ settings: DEFAULT_WEB_SEARCH_SETTINGS });
  webSearchService.setProvider(new MockWebSearchProvider());

  // A pesquisa web é por pedido — não dispara leitura ao ligar. Ainda assim,
  // qualquer pedido acidental no teste falha de forma controlada.
  global.fetch = vi.fn(() => Promise.reject(new Error('sem rede no teste')));
});

afterEach(() => {
  global.fetch = originalFetch;
  webSearchService.setProvider(new MockWebSearchProvider());
});

describe('escolha do provedor', () => {
  it('por omissão fica no simulado — nada sai sem ser pedido', () => {
    applyWebSearchSettings(DEFAULT_WEB_SEARCH_SETTINGS);

    expect(webSearchService.providerName).toBe('Simulado');
  });

  it('provider brave com chave passa à Brave Search', () => {
    applyWebSearchSettings({ ...DEFAULT_WEB_SEARCH_SETTINGS, provider: 'brave', apiKey: KEY });

    expect(webSearchService.providerName).toBe('Brave Search');
  });

  it('provider brave sem chave mantém o simulado', () => {
    applyWebSearchSettings({ ...DEFAULT_WEB_SEARCH_SETTINGS, provider: 'brave', apiKey: '  ' });

    expect(webSearchService.providerName).toBe('Simulado');
  });

  it('provider searxng com endereço passa ao SearXNG', () => {
    applyWebSearchSettings({
      ...DEFAULT_WEB_SEARCH_SETTINGS,
      provider: 'searxng',
      searxngBaseUrl: 'http://localhost:8888',
    });

    expect(webSearchService.providerName).toBe('SearXNG');
  });

  it('provider searxng sem endereço mantém o simulado', () => {
    applyWebSearchSettings({ ...DEFAULT_WEB_SEARCH_SETTINGS, provider: 'searxng', searxngBaseUrl: '  ' });

    expect(webSearchService.providerName).toBe('Simulado');
  });

  it('uma chave guardada sem provider explícito (formato antigo) hidrata como Brave', async () => {
    await storageService.set(STORAGE_KEYS.webSearchSettings, { apiKey: KEY });

    await useWebSearchSettingsStore.getState().hydrate();

    expect(useWebSearchSettingsStore.getState().settings.provider).toBe('brave');
  });
});

describe('a interface', () => {
  it('mostra os três provedores, nenhum aviso por omissão (simulado)', () => {
    render(<SearchSettings />);

    expect(screen.getByRole('radio', { name: /Simulado/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /SearXNG/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Brave Search/ })).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('guardar uma chave liga a Brave Search', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.click(screen.getByRole('radio', { name: /Brave Search/ }));

    await user.type(screen.getByLabelText('Chave da Brave Search'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(webSearchService.providerName).toBe('Brave Search');
    });
  });

  it('a Brave avisa o que sai do dispositivo e para onde', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.click(screen.getByRole('radio', { name: /Brave Search/ }));

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/deste dispositivo/i);
    expect(note).toHaveTextContent('https://api.search.brave.com/res/v1/web/search');
    expect(note).toHaveTextContent(/cofre do sistema/i);
  });

  it('depois de guardada, mostra-se tapada', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.click(screen.getByRole('radio', { name: /Brave Search/ }));
    await user.type(screen.getByLabelText('Chave da Brave Search'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    expect(await screen.findByText(/012345…cdef/)).toBeInTheDocument();
    expect(screen.queryByText(KEY)).toBeNull();
  });

  it('apagar a chave volta ao simulado', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.click(screen.getByRole('radio', { name: /Brave Search/ }));
    await user.type(screen.getByLabelText('Chave da Brave Search'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await user.click(await screen.findByLabelText('Apagar a chave'));

    expect(useWebSearchSettingsStore.getState().settings.apiKey).toBe('');
    expect(webSearchService.providerName).toBe('Simulado');
  });

  it('escolher o SearXNG mostra o endereço por omissão e avisa que a pergunta sai na mesma', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.click(screen.getByRole('radio', { name: /SearXNG/ }));

    expect(screen.getByLabelText('Endereço do SearXNG')).toHaveValue('http://localhost:8888');
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/sai deste dispositivo na mesma/i);
    expect(note).toHaveTextContent(/chave, a conta e o intermediário comercial/i);
  });

  it('mudar o endereço do SearXNG liga o provedor com o novo endereço', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.click(screen.getByRole('radio', { name: /SearXNG/ }));

    const input = screen.getByLabelText('Endereço do SearXNG');
    await user.clear(input);
    await user.type(input, 'http://localhost:9999');
    await user.tab();

    await waitFor(() => {
      expect(useWebSearchSettingsStore.getState().settings.searxngBaseUrl).toBe(
        'http://localhost:9999',
      );
    });
    expect(webSearchService.providerName).toBe('SearXNG');
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar e o provedor volta a ser ligado (Brave)', async () => {
    useWebSearchSettingsStore.getState().setProvider('brave');
    useWebSearchSettingsStore.getState().setApiKey(KEY);
    await useWebSearchSettingsStore.getState().persist();

    useWebSearchSettingsStore.setState({ settings: DEFAULT_WEB_SEARCH_SETTINGS });
    await useWebSearchSettingsStore.getState().hydrate();
    applyWebSearchSettings(useWebSearchSettingsStore.getState().settings);

    expect(useWebSearchSettingsStore.getState().settings.apiKey).toBe(KEY);
    expect(webSearchService.providerName).toBe('Brave Search');
  });

  it('sobrevive a recarregar e o provedor volta a ser ligado (SearXNG)', async () => {
    useWebSearchSettingsStore.getState().setProvider('searxng');
    useWebSearchSettingsStore.getState().setSearxngBaseUrl('http://localhost:7777');
    await useWebSearchSettingsStore.getState().persist();

    useWebSearchSettingsStore.setState({ settings: DEFAULT_WEB_SEARCH_SETTINGS });
    await useWebSearchSettingsStore.getState().hydrate();
    applyWebSearchSettings(useWebSearchSettingsStore.getState().settings);

    expect(useWebSearchSettingsStore.getState().settings.searxngBaseUrl).toBe('http://localhost:7777');
    expect(webSearchService.providerName).toBe('SearXNG');
  });

  it('sem nada gravado, arranca no simulado', async () => {
    await useWebSearchSettingsStore.getState().hydrate();
    applyWebSearchSettings(useWebSearchSettingsStore.getState().settings);

    expect(useWebSearchSettingsStore.getState().settings.apiKey).toBe('');
    expect(webSearchService.providerName).toBe('Simulado');
  });
});
