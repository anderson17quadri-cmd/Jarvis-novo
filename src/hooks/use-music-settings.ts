import { useEffect } from 'react';

import { musicService } from '@/services/music/music-service';
import { MockMusicProvider } from '@/services/music/providers/music-provider';
import { LocalMusicProvider } from '@/services/music/providers/local-music-provider';
import { useMusicSettingsStore } from '@/stores/use-music-settings-store';
import type { MusicSettings } from '@/types/music-settings';

/**
 * Constrói e liga o provedor de música descrito pelas preferências.
 *
 * A presença de uma pasta é a configuração: sem ela, mantém-se o simulado —
 * como no resto dos provedores, cair no local é melhor do que deixar o widget
 * vazio à espera de uma configuração que falta.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store.
 */
export function applyMusicSettings(settings: MusicSettings): void {
  if (settings.rootPath.trim().length > 0) {
    musicService.setProvider(new LocalMusicProvider(settings.rootPath, settings.rootName));
    return;
  }

  musicService.setProvider(new MockMusicProvider());
}

/**
 * Aplica as preferências de música ao serviço sempre que mudam.
 *
 * Mesma forma do `useWeatherSettings`: a store guarda e hidrata, este hook
 * converte as preferências no provedor em vigor. Monta-se uma vez, no arranque.
 */
export function useMusicSettings(): void {
  const settings = useMusicSettingsStore((state) => state.settings);

  useEffect(() => {
    applyMusicSettings(settings);
  }, [settings]);
}
