import { useCallback, useEffect } from 'react';

import { useCapabilities } from '@/hooks/use-platform';
import { useIsVisible } from '@/hooks/use-platform';
import { notificationService } from '@/services/notification-service';
import { voiceService } from '@/services/voice-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { runIntent } from '@/services/voice/executor';
import { describeIntent, isCritical, parseSpeech } from '@/services/voice/intents';

/**
 * Liga a voz ao núcleo e ao assistente.
 *
 * É aqui que o modo do `AICore` deixa de ser decorativo: escutar põe-no em
 * `listening`, uma transcrição manda-o para `thinking` através do `AIService`, e
 * a leitura da resposta põe-no em `speaking`.
 */
export function useVoice(): {
  readonly isSupported: boolean;
  readonly toggleListening: () => void;
  readonly speak: (text: string) => void;
} {
  const capabilities = useCapabilities();
  const isVisible = useIsVisible();
  const setMode = useAssistantStore((state) => state.setMode);
  const pulse = useAssistantStore((state) => state.pulse);

  const isSupported = capabilities.voice && voiceService.isRecognitionSupported;

  const speak = useCallback(
    (text: string): void => {
      voiceService.speak(text, {
        onStart: () => setMode('speaking'),
        onEnd: () => setMode('idle'),
      });
    },
    [setMode],
  );

  const toggleListening = useCallback((): void => {
    pulse();

    if (!isSupported) {
      notificationService.warn(
        'Voz indisponível',
        'Esta plataforma não suporta reconhecimento de voz. Use o teclado.',
      );
      return;
    }

    voiceService.toggleListening({
      onStart: () => setMode('listening'),
      onEnd: () => {
        // Só voltar a repouso se não houver já um pedido a decorrer.
        if (useAssistantStore.getState().mode === 'listening') setMode('idle');
      },
      onError: () => {
        setMode('error');
        notificationService.error('Microfone', 'Não foi possível aceder ao microfone.');
        setTimeout(() => setMode('idle'), 2_000);
      },
      onTranscript: (text) => {
        const parsed = parseSpeech(text);

        for (const intent of parsed.intents) {
          /*
           * Ações que não se desfazem esperam por confirmação (Parte 10).
           *
           * A confirmação é uma notificação com ação, e não um diálogo: já
           * existe, aparece sem tapar o ecrã, e se o utilizador a ignorar o
           * comando simplesmente não acontece — que é o resultado seguro.
           */
          if (isCritical(intent)) {
            notificationService.warn('Confirma?', `Ouvi: "${text}". ${describeIntent(intent)}.`, {
              category: 'assistente',
              durationMs: null,
              actions: [
                {
                  id: 'confirmar',
                  label: 'Confirmar',
                  run: () => runIntent(intent),
                },
              ],
            });
            continue;
          }

          runIntent(intent);
        }

        /*
         * O que foi reconhecido fica à vista (Parte 10 §Correção de erros).
         * Sem isto, um comando mal ouvido executa outra coisa e ninguém
         * percebe porquê. As perguntas não entram: a resposta já é o eco.
         */
        const commands = parsed.intents.filter((intent) => intent.kind !== 'perguntar');
        if (commands.length > 0) {
          notificationService.info(`"${text}"`, commands.map(describeIntent).join(' · '), {
            category: 'assistente',
          });
        }
      },
    });
  }, [isSupported, pulse, setMode]);

  // Falar com a aplicação em segundo plano é ruído sem contexto.
  useEffect(() => {
    if (!isVisible) {
      voiceService.stopSpeaking();
      voiceService.stopListening();
    }
  }, [isVisible]);

  return { isSupported, toggleListening, speak };
}
