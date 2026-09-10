import { useEffect } from 'react';

import { obsidianService } from '@/services/knowledge/obsidian-service';
import { useObsidianSettingsStore } from '@/stores/use-obsidian-settings-store';
import type { ObsidianSettings } from '@/types/obsidian-settings';

/**
 * Relê a lista de notas sempre que o vault escolhido muda.
 *
 * Exportada para os testes poderem aplicá-la após mutações diretas da store
 * — mesmo padrão de `applyMusicSettings`.
 */
export function applyObsidianSettings(settings: ObsidianSettings): void {
  if (settings.rootPath.trim().length > 0) {
    void obsidianService.refreshNotes();
  }
}

/** Aplica as preferências do vault ao serviço sempre que mudam. */
export function useObsidianSettings(): void {
  const settings = useObsidianSettingsStore((state) => state.settings);

  useEffect(() => {
    applyObsidianSettings(settings);
  }, [settings]);
}
