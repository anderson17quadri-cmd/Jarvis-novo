import { notificationService } from './notification-service';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import type { OllamaPullEvent } from '@/types/ollama-pull';

/**
 * Reação ao descarregamento automático do modelo Llama por omissão, quando
 * o Ollama arranca sem nenhum modelo instalado — pedido explícito do
 * utilizador (20/08/2026): "quero o Llama, sem precisar de adicionar mais
 * nada". Separado do `useEffect` em `App.tsx` para ser testável sem montar
 * a app inteira — o mesmo padrão de extração usado no resto da revisão
 * desta noite (`resolve_within_root`, `diff_devices`, `BatteryMonitor::diff`).
 *
 * Só troca o provedor ativo sozinho se as definições de IA ainda estiverem
 * tal e qual vieram por omissão — nunca por cima de uma escolha que a
 * pessoa já tenha feito (DeepSeek, Claude, ou um Ollama com outro modelo).
 */
export function handleOllamaPullEvent(event: OllamaPullEvent): void {
  switch (event.phase) {
    case 'started':
      notificationService.info(
        'A descarregar um modelo local',
        `${event.model}, só desta vez — o JARVIS fica pronto a responder sem nada mais configurado.`,
        { category: 'assistente' },
      );
      return;

    case 'progress':
      return;

    case 'failed':
      notificationService.warn(
        'Não consegui descarregar o modelo',
        `${event.model}: ${event.error}. Tenta "ollama pull ${event.model}" à mão, ou volta a abrir o JARVIS mais tarde.`,
        { category: 'assistente' },
      );
      return;

    case 'done': {
      const current = useAiSettingsStore.getState().settings;
      const aindaPorConfigurar =
        current.provider === 'regras' &&
        current.apiKey.trim() === '' &&
        current.claudeApiKey.trim() === '' &&
        current.ollamaModel.trim() === '';

      if (aindaPorConfigurar) {
        useAiSettingsStore.getState().setOllamaModel(event.model);
        useAiSettingsStore.getState().setProvider('ollama');
        notificationService.success(
          'JARVIS está pronto',
          `${event.model} descarregado e já é o assistente ativo — a responder no próprio dispositivo.`,
          { category: 'assistente' },
        );
      } else {
        notificationService.success(
          'Modelo local pronto',
          `${event.model} já está instalado. Escolhe-o em Personalização → Assistente quando quiseres.`,
          { category: 'assistente' },
        );
      }
    }
  }
}
