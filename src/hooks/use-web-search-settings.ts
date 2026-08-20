import { useEffect } from 'react';

import { BraveSearchProvider } from '@/services/web-search/providers/brave-search-provider';
import { SearxngSearchProvider } from '@/services/web-search/providers/searxng-search-provider';
import { MockWebSearchProvider } from '@/services/web-search/providers/web-search-provider';
import { webSearchService } from '@/services/web-search/web-search-service';
import { useWebSearchSettingsStore } from '@/stores/use-web-search-settings-store';
import type { WebSearchSettings } from '@/types/web-search-settings';

/**
 * Constrói e liga o provedor de pesquisa web descrito pelas preferências.
 *
 * `provider` é a escolha explícita (item 28, 20/08/2026) — Simulado, SearXNG
 * ou Brave. Cada um só se liga se estiver mesmo configurado (chave para a
 * Brave, endereço para o SearXNG); caso contrário cai no simulado, que nunca
 * finge que pesquisou a sério.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store.
 */
export function applyWebSearchSettings(settings: WebSearchSettings): void {
  if (settings.provider === 'brave' && settings.apiKey.trim().length > 0) {
    webSearchService.setProvider(new BraveSearchProvider(settings.apiKey));
    return;
  }

  if (settings.provider === 'searxng' && settings.searxngBaseUrl.trim().length > 0) {
    webSearchService.setProvider(new SearxngSearchProvider(settings.searxngBaseUrl));
    return;
  }

  webSearchService.setProvider(new MockWebSearchProvider());
}

/**
 * Aplica as preferências de pesquisa web ao serviço sempre que mudam.
 *
 * Mesma forma do `useNewsSettings`: a store guarda e hidrata, este hook converte
 * as preferências no provedor em vigor. Monta-se uma vez, no arranque.
 */
export function useWebSearchSettings(): void {
  const settings = useWebSearchSettingsStore((state) => state.settings);

  useEffect(() => {
    applyWebSearchSettings(settings);
  }, [settings]);
}
