import type { ThemeId } from '@/design-system/tokens';
import type { AppId } from '@/types/app';
import type { SystemStateId } from '@/types/system-state';
import type { WidgetId } from '@/types/widget';
import type { VoiceIntent } from './intents';

/**
 * O que a voz sabe pedir ao sistema.
 *
 * Injetado de fora, como as ações da Command Palette e do motor de automações.
 * O interpretador é uma função pura sobre strings; isto é a única peça que
 * toca no sistema, e vive num sítio só.
 */
export interface VoiceExecutor {
  readonly openWindow: (appId: AppId) => void;
  readonly closeAllWindows: () => void;
  readonly setTheme: (theme: ThemeId) => void;
  readonly setSystemState: (state: SystemStateId) => void;
  readonly setWidgetVisible: (widget: WidgetId, show: boolean) => void;
  readonly hideAllWidgets: () => void;
  readonly showAllWidgets: () => void;
  readonly createTask: (title: string) => void;
  readonly search: (query: string) => void;
  readonly music: (action: 'tocar' | 'pausar' | 'proxima' | 'anterior') => void;
  readonly restartInterface: () => void;
  readonly ask: (text: string) => void;
}

/**
 * O executor em vigor.
 *
 * Um só, como o `automationService`: o microfone do header e o da janela do
 * assistente têm de fazer exatamente a mesma coisa, e dar-lhes executores
 * diferentes era abrir a porta a comportarem-se de maneiras diferentes.
 */
let current: VoiceExecutor | null = null;

/** Regista quem executa. Devolve a função que o retira. */
export function setVoiceExecutor(executor: VoiceExecutor): () => void {
  current = executor;
  return () => {
    if (current === executor) current = null;
  };
}

/**
 * Cumpre uma intenção com o executor em vigor.
 *
 * Sem executor registado não faz nada — acontece durante o arranque, antes de
 * o ambiente de trabalho estar de pé, e falhar aí seria pior do que esperar.
 */
export function runIntent(intent: VoiceIntent): void {
  if (!current) return;
  executeIntent(intent, current);
}

/**
 * Cumpre uma intenção.
 *
 * O `switch` é exaustivo de propósito: acrescentar uma intenção sem lhe dar
 * execução passa a ser um erro de compilação, e não um comando que o sistema
 * ouve e ignora em silêncio.
 */
export function executeIntent(intent: VoiceIntent, executor: VoiceExecutor): void {
  switch (intent.kind) {
    case 'abrir-janela':
      executor.openWindow(intent.appId);
      return;
    case 'fechar-janelas':
      executor.closeAllWindows();
      return;
    case 'tema':
      executor.setTheme(intent.theme);
      return;
    case 'estado':
      executor.setSystemState(intent.state);
      return;
    case 'widget':
      executor.setWidgetVisible(intent.widget, intent.show);
      return;
    case 'esconder-widgets':
      executor.hideAllWidgets();
      return;
    case 'mostrar-widgets':
      executor.showAllWidgets();
      return;
    case 'criar-tarefa':
      executor.createTask(intent.title);
      return;
    case 'pesquisar':
      executor.search(intent.query);
      return;
    case 'musica':
      executor.music(intent.action);
      return;
    case 'reiniciar-interface':
      executor.restartInterface();
      return;
    case 'perguntar':
      executor.ask(intent.text);
      return;
  }
}
