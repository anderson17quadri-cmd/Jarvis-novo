import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchSettings } from '@/apps/personalization/SearchSettings';
import { applyWebSearchSettings } from '@/hooks/use-web-search-settings';
import { MockWebSearchProvider } from '@/services/web-search/providers/web-search-provider';
import { webSearchService } from '@/services/web-search/web-search-service';
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

  it('com chave passa à Brave Search', () => {
    applyWebSearchSettings({ apiKey: KEY });

    expect(webSearchService.providerName).toBe('Brave Search');
  });

  it('sem chave mantém o simulado', () => {
    applyWebSearchSettings({ apiKey: '  ' });

    expect(webSearchService.providerName).toBe('Simulado');
  });
});

describe('a interface', () => {
  it('guardar uma chave liga a Brave Search', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);

    await user.type(screen.getByLabelText('Chave da Brave Search'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(webSearchService.providerName).toBe('Brave Search');
    });
  });

  it('avisa o que sai do dispositivo e para onde', () => {
    render(<SearchSettings />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/deste dispositivo/i);
    expect(note).toHaveTextContent('https://api.search.brave.com/res/v1/web/search');
    expect(note).toHaveTextContent(/cofre do sistema/i);
  });

  it('depois de guardada, mostra-se tapada', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.type(screen.getByLabelText('Chave da Brave Search'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    expect(await screen.findByText(/012345…cdef/)).toBeInTheDocument();
    expect(screen.queryByText(KEY)).toBeNull();
  });

  it('apagar a chave volta ao simulado', async () => {
    const user = userEvent.setup();
    render(<SearchSettings />);
    await user.type(screen.getByLabelText('Chave da Brave Search'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await user.click(await screen.findByLabelText('Apagar a chave'));

    expect(useWebSearchSettingsStore.getState().settings.apiKey).toBe('');
    expect(webSearchService.providerName).toBe('Simulado');
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar e o provedor volta a ser ligado', async () => {
    useWebSearchSettingsStore.getState().setApiKey(KEY);
    await useWebSearchSettingsStore.getState().persist();

    useWebSearchSettingsStore.setState({ settings: DEFAULT_WEB_SEARCH_SETTINGS });
    await useWebSearchSettingsStore.getState().hydrate();
    applyWebSearchSettings(useWebSearchSettingsStore.getState().settings);

    expect(useWebSearchSettingsStore.getState().settings.apiKey).toBe(KEY);
    expect(webSearchService.providerName).toBe('Brave Search');
  });

  it('sem nada gravado, arranca no simulado', async () => {
    await useWebSearchSettingsStore.getState().hydrate();
    applyWebSearchSettings(useWebSearchSettingsStore.getState().settings);

    expect(useWebSearchSettingsStore.getState().settings.apiKey).toBe('');
    expect(webSearchService.providerName).toBe('Simulado');
  });
});
