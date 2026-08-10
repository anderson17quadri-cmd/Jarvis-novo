import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * O microfone nunca liga enquanto o JARVIS está a falar (Parte 7.2 §Voz) —
 * o arranjo para o eco acústico: a própria voz do sistema, ouvida pelo
 * microfone pelas colunas, sem nada a impedir uma gravação de começar
 * durante ou logo a seguir a `speak()`/`speakClonada()`.
 *
 * Testado aqui pela via do sistema (mais fácil de controlar sem rede) —
 * `speak()` limpa o texto e escolhe a voz antes de chegar a qualquer uma
 * das duas, por isso o bloqueio, que vive em `toggleListening`, é o mesmo
 * para as duas.
 */

class FakeUtterance {
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  voice: unknown = null;
  lang = '';
  rate = 1;
  pitch = 1;

  constructor(public text: string) {}
}

function withFakeSynthesis(): { utterance: FakeUtterance | null; restore: () => void } {
  const state: { utterance: FakeUtterance | null } = { utterance: null };
  const originalSynthesis = (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  const originalUtterance = (globalThis as unknown as { SpeechSynthesisUtterance?: unknown })
    .SpeechSynthesisUtterance;

  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    getVoices: () => [],
    speak: (utterance: FakeUtterance) => {
      state.utterance = utterance;
      utterance.onstart?.();
    },
    cancel: vi.fn(),
  };

  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;

  return {
    get utterance() {
      return state.utterance;
    },
    restore: () => {
      (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSynthesis;
      (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
        originalUtterance;
    },
  };
}

describe('o microfone nunca liga enquanto se fala', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('a meio de speak(), toggleListening() é recusado com o motivo "a-falar"', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'sistema', voiceURI: 'x' });

    // O `onstart` já disparou (a voz falsa dispara-o de imediato) — a voz
    // está "a tocar", sem `onend` ter disparado ainda.
    const onError = vi.fn();
    const iniciou = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(iniciou).toBe(false);
    expect(onError).toHaveBeenCalledWith('a-falar');
    expect(service.isListening).toBe(false);
  });

  it('logo a seguir a acabar de falar (dentro do período de segurança), continua recusado', () => {
    vi.useFakeTimers();
    const env = withFakeSynthesis();
    restore = env.restore;

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'sistema', voiceURI: 'x' });
    env.utterance?.onend?.();

    const onError = vi.fn();
    const iniciou = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(iniciou).toBe(false);
    expect(onError).toHaveBeenCalledWith('a-falar');
  });

  it('passado o período de segurança, o microfone volta a ligar normalmente', async () => {
    vi.useFakeTimers();
    const env = withFakeSynthesis();
    restore = env.restore;

    // Sem serviço local a responder, cai para o reconhecimento nativo —
    // não é isso que se testa aqui, só que a recusa desaparece a tempo.
    global.fetch = vi.fn(() => Promise.reject(new Error('sem rede nos testes')));

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'sistema', voiceURI: 'x' });
    env.utterance?.onend?.();

    await vi.advanceTimersByTimeAsync(1_000); // > SPEAK_GUARD_MS (900ms)

    const onError = vi.fn();
    const iniciou = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(iniciou).toBe(true);
    expect(onError).not.toHaveBeenCalledWith('a-falar');
  });

  it('stopSpeaking() a meio da fala também bloqueia o microfone a seguir', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'sistema', voiceURI: 'x' });
    service.stopSpeaking();

    const onError = vi.fn();
    const iniciou = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(iniciou).toBe(false);
    expect(onError).toHaveBeenCalledWith('a-falar');
  });

  it('sem nada a falar, o microfone liga normalmente — o bloqueio não fica sempre ligado', () => {
    const service = new VoiceService();
    const onError = vi.fn();

    const iniciou = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(iniciou).toBe(true);
    expect(onError).not.toHaveBeenCalledWith('a-falar');
  });

  it('a voz clonada bloqueia já ao pedir o áudio, não só quando ele chega a tocar', async () => {
    // A gravação em vídeo de um teste ao vivo apanhou exatamente este
    // buraco: a voz clonada pede o áudio ao serviço local antes de o tocar
    // (rede + síntese, pode demorar segundos) — sem marcar já aqui, o
    // microfone continuava livre enquanto se esperava por ele.
    const controlo: { resolver: () => void } = { resolver: () => undefined };
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          controlo.resolver = () =>
            resolve(new Response(new Blob(['audio-a-fingir']), { status: 200 }));
        }),
    ) as unknown as typeof fetch;

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'clonada', nome: null });

    // O `fetch` ainda não resolveu — a voz clonada ainda não tocou nada.
    const onError = vi.fn();
    const iniciou = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(iniciou).toBe(false);
    expect(onError).toHaveBeenCalledWith('a-falar');

    controlo.resolver();
  });
});
