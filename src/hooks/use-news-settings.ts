import { useEffect } from 'react';

import { newsService } from '@/services/news/news-service';
import { MockNewsProvider } from '@/services/news/providers/news-provider';
import { NewsApiProvider } from '@/services/news/providers/news-api-provider';
import { useNewsSettingsStore } from '@/stores/use-news-settings-store';
import type { NewsSettings } from '@/types/news-settings';

/**
 * Constrói e liga o provedor de notícias descrito pelas preferências.
 *
 * A presença da chave é a configuração: sem chave, mantém-se o simulado — como
 * na DeepSeek, cair no local é melhor do que deixar o widget vazio à espera de
 * uma configuração que falta.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store.
 */
export function applyNewsSettings(settings: NewsSettings): void {
  if (settings.apiKey.trim().length > 0) {
    newsService.setProvider(new NewsApiProvider(settings.apiKey, settings.country));
    return;
  }

  newsService.setProvider(new MockNewsProvider());
}

/**
 * Aplica as preferências de notícias ao serviço sempre que mudam.
 *
 * Mesma forma do `useAiSettings`: a store guarda e hidrata, este hook converte
 * as preferências no provedor em vigor. Monta-se uma vez, no arranque.
 */
export function useNewsSettings(): void {
  const settings = useNewsSettingsStore((state) => state.settings);

  useEffect(() => {
    applyNewsSettings(settings);
  }, [settings]);
}
