import { seedAutomations } from '@/data/automations';
import { automationService } from '@/services/automation-service';
import { memoryService } from '@/services/assistant/memory-service';
import { soundService } from '@/services/sound-service';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useCustomThemeStore } from '@/stores/use-custom-theme-store';
import { useBrowserToolSettingsStore } from '@/stores/use-browser-tool-settings-store';
import { useMailSettingsStore } from '@/stores/use-mail-settings-store';
import { useMusicSettingsStore } from '@/stores/use-music-settings-store';
import { useNewsSettingsStore } from '@/stores/use-news-settings-store';
import { useObsidianSettingsStore } from '@/stores/use-obsidian-settings-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { useTaskStore } from '@/stores/use-task-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';
import { useWeatherSettingsStore } from '@/stores/use-weather-settings-store';
import { useWebSearchSettingsStore } from '@/stores/use-web-search-settings-store';
import { useWidgetStore } from '@/stores/use-widget-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Ler tudo o que está guardado para dentro das stores.
 *
 * Corre no arranque e outra vez depois de repor uma cópia de segurança. Está
 * num sítio só por causa da segunda: com a sequência escrita no `App.tsx`,
 * uma store acrescentada mais tarde passava a hidratar no arranque e a ficar
 * de fora do restauro — e o sintoma seria "repus a cópia e as tarefas não
 * voltaram", sem nada a apontar para a causa.
 *
 * A ordem importa num ponto: as definições de IA são as últimas, porque o
 * provedor que elas constroem precisa da memória já lida.
 *
 * O que fica de fora, de propósito (revisão 14/08/2026): `windowLayout`.
 * Repor uma cópia grava `window-layout`, mas reabrir as janelas nas posições
 * guardadas é uma operação com efeitos (abre janelas a sério), feita pelo
 * `restoreSavedLayout` no arranque — não uma hidratação passiva como as outras.
 * Reabrir tudo a meio de uma sessão (com o painel de cópia aberto) seria pior,
 * por isso o layout restaurado só se aplica no arranque seguinte. As restantes
 * chaves sem `hydrate()` estão seguras ou são mortas: `newsMarks` lê-se à
 * vontade em cada pedido de notícias, `booted` só interessa ao arranque, e
 * `lastUser`/`reducedMotion` não têm leitor (ver `backup.ts`).
 */
export async function hydrateAll(): Promise<void> {
  await useThemeStore.getState().hydrate();
  // O tema já lê os personalizados por dentro — precisa deles para poder
  // aplicar um. Repete-se aqui na mesma: esta lista é o que o restauro promete
  // repor, e depender de uma chamada escondida noutro ficheiro é a maneira de
  // isso se perder sem ninguém dar por ela. A leitura a mais é uma leitura.
  await useCustomThemeStore.getState().hydrate();
  await useNotificationStore.getState().hydrate();
  await useWidgetStore.getState().hydrate();
  await usePluginStore.getState().hydrate();
  await useSystemStateStore.getState().hydrate();
  await useAppearanceStore.getState().hydrate();
  await useTaskStore.getState().hydrate();
  await useVoiceSettingsStore.getState().hydrate();
  await useWeatherSettingsStore.getState().hydrate();
  await useNewsSettingsStore.getState().hydrate();
  await useMailSettingsStore.getState().hydrate();
  await useMusicSettingsStore.getState().hydrate();
  await useObsidianSettingsStore.getState().hydrate();
  await useBrowserToolSettingsStore.getState().hydrate();
  await useWebSearchSettingsStore.getState().hydrate();
  await soundService.hydrate();
  await automationService.hydrate(seedAutomations());
  await useAssistantStore.getState().hydrate();
  await memoryService.hydrate();
  await useWorkspaceStore.getState().hydrate();
  await useAiSettingsStore.getState().hydrate();
}
