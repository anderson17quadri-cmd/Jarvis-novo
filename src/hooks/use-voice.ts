import { useCallback, useEffect, useRef } from 'react';

import { useCapabilities } from '@/hooks/use-platform';
import { useIsVisible } from '@/hooks/use-platform';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { voiceService, type SpeechRecognitionErrorKind } from '@/services/voice-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useVoiceCorrectionStore } from '@/stores/use-voice-correction-store';
import { runIntent } from '@/services/voice/executor';
import { describeIntent, isCritical, parseSpeech } from '@/services/voice/intents';

/**
 * O que dizer por cada código de erro do reconhecimento.
 */
const VOICE_ERROR_MESSAGES: Partial<Record<string, string>> = {
  'not-allowed':
    'O Windows recusou o acesso ao microfone. Em Definições → Privacidade e segurança → Microfone, permita o acesso a aplicações de escrivaninha.',
  'permission-denied':
    'O Windows recusou o acesso ao microfone. Em Definições → Privacidade e segurança → Microfone, permita o acesso a aplicações de escrivaninha.',
  'audio-capture': 'Não encontrei nenhum microfone ligado a este dispositivo.',
  network:
    'O motor de voz deste PC não tem o serviço de reconhecimento disponível — é uma limitação conhecida do WebView2 (o motor do Tauri no Windows), não desta app.',
  'service-not-allowed':
    'O serviço de reconhecimento de voz não está disponível neste motor — mesma limitação do WebView2.',
  timeout:
    'O motor de voz deste PC não respondeu — é uma limitação conhecida do WebView2. Liga o voice-clone-service (voice-clone-service/run.ps1) para usares o reconhecimento local em vez deste.',
  'no-speech': 'Não percebi nada na gravação. Tenta falar mais perto do microfone, ou mais alto.',
  'local-service-unavailable':
    'O serviço de voz local parou a meio do reconhecimento. Confirma se ainda está a correr (voice-clone-service/run.ps1) e tenta outra vez.',
  'a-falar':
    'Espera só um instante — ainda estou a falar. Ligar o microfone agora arriscava ouvir-me a mim mesmo pelas colunas.',
};

function describeVoiceError(kind: SpeechRecognitionErrorKind | null): string {
  if (kind && VOICE_ERROR_MESSAGES[kind]) return VOICE_ERROR_MESSAGES[kind];
  if (kind) return `Não foi possível aceder ao microfone (${kind}).`;
  return 'Não foi possível aceder ao microfone.';
}

const MAX_NO_SPEECH_ATTEMPTS = 3;
const REENGAGE_DELAY_MS = 1_100;
const CONVERSATION_WARN_KEY = 'jarvis.conversation-warned';

/**
 * Liga a voz ao núcleo e ao assistente.
 *
 * Com o modo conversa ativo, o microfone liga-se automaticamente após cada
 * resposta — o ciclo fecha-se sem intervenção manual.
 */
export function useVoice(): {
  readonly isSupported: boolean;
  readonly toggleListening: () => void;
  readonly speak: (text: string) => void;
  readonly isConversationMode: boolean;
  readonly toggleConversationMode: () => void;
} {
  const capabilities = useCapabilities();
  const isVisible = useIsVisible();
  const setMode = useAssistantStore((state) => state.setMode);
  const pulse = useAssistantStore((state) => state.pulse);

  const isSupported = capabilities.voice && voiceService.isRecognitionSupported;

  // ── Re-engate do modo conversa ──────────────────────────────────────────

  const reengageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Guarda a versão mais recente do callback de re-engate para evitar
   *  dependência circular no próprio `useCallback`. */
  const tentarReengatarRef = useRef<() => void>(() => undefined);

  const limparReengate = useCallback((): void => {
    if (reengageTimerRef.current !== null) {
      clearTimeout(reengageTimerRef.current);
      reengageTimerRef.current = null;
    }
  }, []);

  // ── Processamento do que se ouviu ──────────────────────────────────────

  const processTranscript = useCallback((text: string): void => {
    const parsed = parseSpeech(text);

    for (const intent of parsed.intents) {
      if (isCritical(intent)) {
        notificationService.warn('Confirma?', `Ouvi: "${text}". ${describeIntent(intent)}.`, {
          category: 'assistente',
          durationMs: null,
          actions: [
            { id: 'confirmar', label: 'Confirmar', run: () => runIntent(intent) },
            { id: 'corrigir', label: 'Corrigir', run: () => useVoiceCorrectionStore.getState().open(text) },
          ],
        });
        continue;
      }
      runIntent(intent);
    }

    const commands = parsed.intents.filter((intent) => intent.kind !== 'perguntar');
    if (commands.length > 0) {
      notificationService.info(`"${text}"`, commands.map(describeIntent).join(' · '), {
        category: 'assistente',
        actions: [
          { id: 'corrigir', label: 'Corrigir', run: () => useVoiceCorrectionStore.getState().open(text) },
        ],
      });
    }
  }, []);

  // ── Callbacks de escuta — partilhados entre o microfone manual e o re-engate ──

  const makeListeningCallbacks = useCallback(
    (): Parameters<typeof voiceService.toggleListening>[0] => ({
      onStart: () => setMode('listening'),
      onEnd: () => {
        if (useAssistantStore.getState().mode === 'listening') setMode('idle');
        // No modo conversa, o fim de uma escuta sem transcrição re-engata.
        tentarReengatarRef.current();
      },
      onError: (kind) => {
        setMode('error');
        logService.log('erro', 'voz', 'O reconhecimento falhou', kind ?? '(sem código)');

        if (kind === 'no-speech') {
          voiceService.incrementNoSpeech();
          if (voiceService.consecutiveNoSpeechCount >= MAX_NO_SPEECH_ATTEMPTS) {
            voiceService.setConversationMode(false);
            notificationService.info(
              'Modo conversa',
              `Desliguei o modo conversa — ${MAX_NO_SPEECH_ATTEMPTS} tentativas seguidas sem ninguém falar.`,
            );
            return;
          }
        } else {
          notificationService.error('Microfone', describeVoiceError(kind));
          setTimeout(() => setMode('idle'), 2_000);
        }

        tentarReengatarRef.current();
      },
      onTranscript: (text) => {
        voiceService.resetNoSpeech();
        processTranscript(text);
      },
    }),
    [setMode, processTranscript],
  );

  // ── Re-engate do microfone após a resposta ─────────────────────────────

  const tentarReengatar = useCallback((): void => {
    limparReengate();
    if (!voiceService.isConversationMode) return;
    if (voiceService.isListening) return;

    reengageTimerRef.current = setTimeout(() => {
      reengageTimerRef.current = null;
      if (!voiceService.isConversationMode) return;

      voiceService.toggleListening(makeListeningCallbacks());
    }, REENGAGE_DELAY_MS);
  }, [limparReengate, makeListeningCallbacks]);

  // Atualiza o ref para que os callbacks internos vejam sempre a versão mais
  // recente, sem criar dependência circular no próprio `useCallback`.
  tentarReengatarRef.current = tentarReengatar;

  // ── Falar ──────────────────────────────────────────────────────────────

  const speak = useCallback(
    (text: string): void => {
      limparReengate();

      voiceService.speak(text, {
        onStart: () => setMode('speaking'),
        onEnd: () => {
          if (voiceService.isConversationMode) {
            tentarReengatar();
          } else {
            setMode('idle');
          }
        },
      });
    },
    [setMode, limparReengate, tentarReengatar],
  );

  // ── Microfone manual ───────────────────────────────────────────────────

  const toggleListening = useCallback((): void => {
    pulse();

    if (!isSupported) {
      notificationService.warn(
        'Voz indisponível',
        'Esta plataforma não suporta reconhecimento de voz. Use o teclado.',
      );
      return;
    }

    // Clicar no microfone com o modo conversa ativo desliga-o.
    if (voiceService.isConversationMode) {
      voiceService.setConversationMode(false);
      limparReengate();
      setMode('idle');
      return;
    }

    voiceService.toggleListening(makeListeningCallbacks());
  }, [isSupported, pulse, setMode, limparReengate, makeListeningCallbacks]);

  // ── Modo conversa ──────────────────────────────────────────────────────

  const toggleConversationMode = useCallback((): void => {
    const ativo = !voiceService.isConversationMode;
    voiceService.setConversationMode(ativo);

    if (ativo) {
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(CONVERSATION_WARN_KEY)) {
        sessionStorage.setItem(CONVERSATION_WARN_KEY, '1');
        notificationService.info(
          'Modo conversa',
          'O microfone liga-se automaticamente após cada resposta. Pode desligá-lo a qualquer momento no botão ao lado do microfone.',
          { category: 'assistente', durationMs: 8_000 },
        );
      }

      if (!voiceService.isListening) {
        tentarReengatar();
      }
    } else {
      limparReengate();
    }
  }, [limparReengate, tentarReengatar]);

  // ── Segundo plano ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isVisible) {
      voiceService.stopSpeaking();
      voiceService.stopListening();
      limparReengate();
    }
  }, [isVisible, limparReengate]);

  useEffect(() => {
    return () => limparReengate();
  }, [limparReengate]);

  return {
    isSupported,
    toggleListening,
    speak,
    isConversationMode: voiceService.isConversationMode,
    toggleConversationMode,
  };
}
