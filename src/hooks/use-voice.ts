import { useCallback, useEffect } from 'react';

import { useCapabilities } from '@/hooks/use-platform';
import { useIsVisible } from '@/hooks/use-platform';
import { aiService } from '@/services/ai-service';
import { notificationService } from '@/services/notification-service';
import { voiceService } from '@/services/voice-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AppId } from '@/types/app';

interface UseVoiceOptions {
  /** Abre a janela do assistente quando chega uma transcrição. */
  readonly onLaunchApp: (appId: AppId) => void;
}

/**
 * Liga a voz ao núcleo e ao assistente.
 *
 * É aqui que o modo do `AICore` deixa de ser decorativo: escutar põe-no em
 * `listening`, uma transcrição manda-o para `thinking` através do `AIService`, e
 * a leitura da resposta põe-no em `speaking`.
 */
export function useVoice({ onLaunchApp }: UseVoiceOptions): {
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
        onLaunchApp('assistant');
        void aiService.send(text).then((reply) => {
          if (reply.length > 0) speak(reply);
        });
      },
    });
  }, [isSupported, onLaunchApp, pulse, setMode, speak]);

  // Falar com a aplicação em segundo plano é ruído sem contexto.
  useEffect(() => {
    if (!isVisible) {
      voiceService.stopSpeaking();
      voiceService.stopListening();
    }
  }, [isVisible]);

  return { isSupported, toggleListening, speak };
}
