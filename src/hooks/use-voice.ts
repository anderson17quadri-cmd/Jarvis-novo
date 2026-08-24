import { useCallback, useEffect, useRef } from 'react';

import { getPlatformAdapter } from '@/platform';
import { useCapabilities } from '@/hooks/use-platform';
import { useIsVisible } from '@/hooks/use-platform';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { voiceService, type SpeechRecognitionErrorKind } from '@/services/voice-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useVoiceCorrectionStore } from '@/stores/use-voice-correction-store';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';
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
const CLONE_WARN_KEY = 'jarvis.clone-voice-warned';
const WAKE_WORD_URL = 'http://127.0.0.1:8091';

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
  /** Como `speak`, mas enfileira — chamar várias vezes seguidas fala uma
   *  frase de cada vez, sem cortar a anterior a meio. Para respostas em
   *  streaming, onde o texto chega aos bocados. */
  readonly speakQueued: (text: string) => void;
  /** Esvazia a fila por frases — para quando a fala deve parar já (janela
   *  fechada, segundo plano, resposta nova), não deixar o resto falar. */
  readonly limparFilaDeFala: () => void;
  readonly isConversationMode: boolean;
  readonly toggleConversationMode: () => void;
} {
  const capabilities = useCapabilities();
  const isVisible = useIsVisible();
  const setMode = useAssistantStore((state) => state.setMode);
  const pulse = useAssistantStore((state) => state.pulse);
  const micAlwaysOn = useVoiceSettingsStore((state) => state.micAlwaysOn);
  const wakeWordEnabled = useVoiceSettingsStore((state) => state.wakeWordEnabled);
  const wakeWord = useVoiceSettingsStore((state) => state.wakeWord);

  const isSupported = capabilities.voice && voiceService.isRecognitionSupported;

  // ── Voz clonada indisponível ───────────────────────────────────────────

  /**
   * Explica o silêncio quando a voz clonada falha (achado ao vivo,
   * 14/08/2026): o serviço local é um processo à parte, e esquecer de o
   * arrancar deixava o assistente mudo sem dizer porquê. Agora cai para a
   * voz do sistema e avisa — uma vez por sessão, que é o que basta para
   * perceber; repetir a cada frase seria pior do que o silêncio.
   */
  useEffect(() => {
    voiceService.onCloneServiceUnavailable = () => {
      if (sessionStorage.getItem(CLONE_WARN_KEY) !== null) return;
      sessionStorage.setItem(CLONE_WARN_KEY, '1');

      notificationService.warn(
        'Voz clonada indisponível',
        'O serviço de voz local não respondeu — estou a usar a voz do sistema. ' +
          'Para voltar à voz clonada, arranca o voice-clone-service (voice-clone-service/run.ps1).',
        { category: 'assistente' },
      );
    };

    // Auto-recuperação (sub-fase 4.4): quando a síntese falha por o serviço
    // estar em baixo ou "partido" (CUDA envenenado), pede ao Rust para o
    // reiniciar. A frase atual cai para a voz do sistema; a seguinte já usa
    // o serviço fresco. Silencioso de propósito — o aviso acima já cobre o
    // utilizador, e um reinício que demora não é um erro a gritar.
    voiceService.onCloneServiceNeedsRestart = () => {
      void getPlatformAdapter().restartVoiceService();
    };

    return () => {
      voiceService.onCloneServiceUnavailable = null;
      voiceService.onCloneServiceNeedsRestart = null;
    };
  }, []);

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

  /**
   * `true` durante o ciclo de escuta atual se já houve um erro que não seja
   * `no-speech` — evita re-engatar o microfone quando o serviço está em baixo
   * ou o microfone está desligado, o que criaria um ciclo infinito.
   */
  const erroFatalRef = useRef(false);

  const makeListeningCallbacks = useCallback(
    (): Parameters<typeof voiceService.toggleListening>[0] => {
      erroFatalRef.current = false;

      return {
        onStart: () => setMode('listening'),
        onEnd: () => {
          if (useAssistantStore.getState().mode === 'listening') setMode('idle');
          // Só re-engata se não houve erro fatal neste ciclo.
          if (!erroFatalRef.current) {
            tentarReengatarRef.current();
          }
        },
        onError: (kind) => {
          // `no-speech` (silêncio) e `a-falar` (o guarda de eco a segurar o
          // microfone enquanto a voz ainda soa) são transientes, não erros:
          // não põem o núcleo em "erro" nem sujam o registo. Só os erros
          // persistentes (serviço em baixo, microfone desligado) o fazem —
          // re-engatar aí seria um ciclo infinito.
          const transiente = kind === 'no-speech' || kind === 'a-falar';

          // `no-speech` acumula para desligar o modo conversa ao fim de
          // N tentativas. `a-falar` não conta — o sistema estar a falar
          // não é culpa de ninguém.
          if (kind === 'no-speech') {
            voiceService.incrementNoSpeech();
            if (voiceService.consecutiveNoSpeechCount >= MAX_NO_SPEECH_ATTEMPTS) {
              voiceService.setConversationMode(false);
              notificationService.info(
                'Modo conversa',
                `Desliguei o modo conversa — ${MAX_NO_SPEECH_ATTEMPTS} tentativas seguidas sem ninguém falar.`,
              );
              erroFatalRef.current = true;
              return;
            }
          }

          if (transiente) {
            // `no-speech`: o `onEnd` que vem logo a seguir re-engata.
            // `a-falar`: não há `onEnd` (o `toggleListening` devolveu antes
            // de começar), mas o `onEnd` da fala em curso recupera o ciclo.
            // Nenhum dos dois merece pôr o núcleo em erro.
            return;
          }

          setMode('error');
          logService.log('erro', 'voz', 'O reconhecimento falhou', kind ?? '(sem código)');
          erroFatalRef.current = true;
          notificationService.error('Microfone', describeVoiceError(kind));
          setTimeout(() => setMode('idle'), 2_000);
        },
        onTranscript: (text) => {
          voiceService.resetNoSpeech();
          processTranscript(text);
        },
      };
    },
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
  // recente, sem criar dependência circular no próprio `useCallback`. Num
  // efeito, nunca durante o render — mutar um ref a meio do render é o
  // mesmo erro já corrigido no rascunho de anexos de email (Compose,
  // EmailsWindow.tsx), desta vez aqui.
  useEffect(() => {
    tentarReengatarRef.current = tentarReengatar;
  }, [tentarReengatar]);

  // ── Fila de fala por frases (estado partilhado com `speak`) ────────────

  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef(false);

  /**
   * Esvazia a fila de fala por frases. Sem isto, `stopSpeaking()` só cala a
   * frase a tocar — a frase seguinte (que já estava na fila) falava na
   * mesma, já sem a pessoa a ver o assistente nem o contexto que a gerou.
   */
  const limparFilaDeFala = useCallback((): void => {
    speechQueueRef.current = [];
    isSpeakingQueueRef.current = false;
  }, []);

  // ── Falar ──────────────────────────────────────────────────────────────

  const speak = useCallback(
    (text: string): void => {
      // Cancela qualquer re-engate pendente E para a escuta atual, se
      // houver uma — sem isto, o microfone podia estar ativo enquanto
      // a IA fala, e ouvia-se a si mesma pelas colunas.
      limparReengate();
      voiceService.stopListening();

      // Uma fala avulsa interrompe a fila por frases: sem isto, o `onEnd`
      // da frase cortada avançava a fila e a frase seguinte falava por
      // cima desta, perdendo a fala avulsa.
      limparFilaDeFala();

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
    [setMode, limparReengate, tentarReengatar, limparFilaDeFala],
  );

  // ── Falar por frases, à medida que chegam (resposta em streaming) ──────

  /** Mesmo truque do `tentarReengatarRef` acima — evita a recursão direta
   *  do `useCallback` a chamar-se a si próprio antes de estar declarado. */
  const playNextQueuedRef = useRef<() => void>(() => undefined);

  /**
   * Só fala a frase seguinte depois do `onEnd` da anterior, nunca em
   * paralelo — `voiceService.speak()` cancela qualquer fala em curso, por
   * isso chamá-lo uma vez por frase, sem fila, cortaria a anterior a meio.
   */
  const playNextQueued = useCallback((): void => {
    const next = speechQueueRef.current.shift();
    if (next === undefined) {
      isSpeakingQueueRef.current = false;
      if (voiceService.isConversationMode) {
        tentarReengatar();
      } else {
        setMode('idle');
      }
      return;
    }

    voiceService.speak(next, {
      onStart: () => {
        setMode('speaking');
        // Enquanto esta frase toca, pré-sintetiza a seguinte (se já cá está)
        // para a próxima não pagar a latência do serviço de voz local — é
        // essa latência, frase a frase, que se ouvia como pausas.
        const seguinte = speechQueueRef.current[0];
        if (seguinte !== undefined) voiceService.prefetchClonada(seguinte);
      },
      onEnd: () => playNextQueuedRef.current(),
    });
  }, [setMode, tentarReengatar]);

  useEffect(() => {
    playNextQueuedRef.current = playNextQueued;
  }, [playNextQueued]);

  const speakQueued = useCallback(
    (text: string): void => {
      if (text.trim().length === 0) return;

      speechQueueRef.current.push(text);
      if (isSpeakingQueueRef.current) return;

      isSpeakingQueueRef.current = true;
      limparReengate();
      voiceService.stopListening();
      playNextQueued();
    },
    [limparReengate, playNextQueued],
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

    // A falar: o clique é um barge-in — para a fala e ouve já, sem esperar
    // pela resposta acabar. A fila esvazia-se primeiro, senão o `onEnd` da
    // fala cortada avançava a fila e a frase seguinte falava por cima da
    // escuta que está a começar.
    if (voiceService.isSpeaking) {
      limparFilaDeFala();
      voiceService.bargeIn(makeListeningCallbacks());
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
  }, [isSupported, pulse, setMode, limparReengate, makeListeningCallbacks, limparFilaDeFala]);

  // ── Modo conversa ──────────────────────────────────────────────────────

  const toggleConversationMode = useCallback((): void => {
    const ativo = !voiceService.isConversationMode;
    voiceService.setConversationMode(ativo);
    // Guardar a escolha: com isto, o microfone fica "sempre ativo" a atravessar
    // reinícios, e não só até fechar a aplicação.
    useVoiceSettingsStore.getState().setMicAlwaysOn(ativo);

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

  // ── Microfone sempre ativo ─────────────────────────────────────────────

  /**
   * Se a preferência ficou guardada, liga o modo conversa sozinho no
   * arranque. Só dispara quando `micAlwaysOn` passa a `true` — o que acontece
   * depois do `hydrate`, nunca durante o render — por isso não arranca o
   * microfone antes de se saber que o querem a ouvir.
   */
  useEffect(() => {
    if (!micAlwaysOn || voiceService.isConversationMode) return;
    voiceService.setConversationMode(true);
    if (!voiceService.isListening) tentarReengatar();
  }, [micAlwaysOn, tentarReengatar]);

  useEffect(() => {
    if (!wakeWordEnabled) {
      void getPlatformAdapter().stopWakeWord();
      return;
    }

    let cancelled = false;
    let lastEventId = 0;
    const activate = async (): Promise<void> => {
      // A wake word acorda o reconhecimento real — sem o serviço local de voz
      // a correr, esse reconhecimento cairia para o nativo (nuvem) à calada,
      // exatamente o que a decisão do §6.3 do desenho recusa. Por isso recusa
      // armar-se aqui, antes sequer de arrancar o motor de deteção.
      const servicoLocalDeVozOk = await voiceService.localSttReachable();
      if (!servicoLocalDeVozOk) {
        if (!cancelled) {
          notificationService.warn(
            'Wake word não ligada',
            'Precisa do serviço local de voz a correr (voice-clone-service) — sem ele, o comando a seguir à palavra cairia para a nuvem. Arranca-o e tenta outra vez.',
            { category: 'assistente' },
          );
          useVoiceSettingsStore.getState().setWakeWordEnabled(false);
        }
        return;
      }

      const started = await getPlatformAdapter().startWakeWord(wakeWord);
      if (!started && !cancelled) {
        notificationService.warn(
          'Wake word indisponível',
          'Prepara primeiro o motor local com wake-word-service/setup.ps1.',
          { category: 'assistente' },
        );
        useVoiceSettingsStore.getState().setWakeWordEnabled(false);
      }
    };
    // Uma sondagem falhada é normal (o serviço a reiniciar, um soluço). Muitas
    // seguidas não são: o serviço morreu. Sem isto, o `catch` engolia tudo — o
    // indicador continuava a dizer "a ouvir", o interruptor ligado, e a
    // palavra deixava de funcionar sem nada explicar porquê. É a mesma falha
    // silenciosa da voz clonada muda (15/08) e das falhas de rede dos widgets
    // (20/08).
    let falhasSeguidas = 0;
    const MAX_FALHAS_SEGUIDAS = 6; // ~3 segundos ao ritmo de 500 ms

    const check = async (): Promise<void> => {
      try {
        const response = await fetch(`${WAKE_WORD_URL}/health`);
        const status = (await response.json()) as { event_id?: number };
        falhasSeguidas = 0;
        const eventId = status.event_id ?? 0;
        if (eventId > lastEventId && !voiceService.isListening && !voiceService.isSpeaking) {
          voiceService.toggleListening(makeListeningCallbacks());
          logService.log('info', 'voz', 'Wake word ouvida', `"${wakeWord}" — a acordar o reconhecimento`);
        }
        lastEventId = eventId;
      } catch {
        falhasSeguidas += 1;
        if (falhasSeguidas < MAX_FALHAS_SEGUIDAS || cancelled) return;

        logService.log('erro', 'voz', 'A wake word deixou de responder', 'serviço local sem resposta');
        notificationService.warn(
          'Wake word desligada',
          'O serviço local de deteção deixou de responder. Volta a ligá-la em Privacidade quando estiver de pé.',
          { category: 'assistente' },
        );
        useVoiceSettingsStore.getState().setWakeWordEnabled(false);
      }
    };

    void activate();
    const timer = setInterval(() => void check(), 500);
    return () => {
      cancelled = true;
      clearInterval(timer);
      void getPlatformAdapter().stopWakeWord();
    };
  }, [makeListeningCallbacks, wakeWord, wakeWordEnabled]);

  // ── Segundo plano ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isVisible) {
      // Segundo plano: para tudo — fala, escuta e o re-engate pendente.
      // O modo conversa fica ativo; o ramo de baixo retoma-o ao voltar.
      voiceService.stopSpeaking();
      voiceService.stopListening();
      limparReengate();
      limparFilaDeFala();
      return;
    }

    // Ao voltar (ou no arranque), se o modo conversa continua ativo, o ciclo
    // retoma — sem isto, depois de ir a segundo plano o microfone nunca mais
    // ligava sozinho, apesar de o botão continuar a dizer que o modo está
    // ativo e o histórico prometer "retoma-se ao voltar".
    if (voiceService.isConversationMode && !voiceService.isListening) {
      tentarReengatar();
    }
  }, [isVisible, limparReengate, limparFilaDeFala, tentarReengatar]);

  useEffect(() => {
    return () => limparReengate();
  }, [limparReengate]);

  return {
    isSupported,
    toggleListening,
    speak,
    speakQueued,
    limparFilaDeFala,
    isConversationMode: voiceService.isConversationMode,
    toggleConversationMode,
  };
}
