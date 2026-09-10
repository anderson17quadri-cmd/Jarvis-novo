import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Reconhecimento de voz — o código do erro (Parte 7.2 §Voz).
 *
 * Antes desta correção, `onError` não recebia nada: um `start()` que falhasse
 * — sem permissão, sem microfone, ou sem o serviço de reconhecimento por
 * trás do construtor (o caso do WebView2 no Windows) — desligava a escuta em
 * silêncio, sem pista nenhuma de porquê. Agora o código chega sempre que o
 * navegador o dá.
 */

/** Um `SpeechRecognition` de mentira, para controlar o que `start()` faz. */
class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(private readonly behaviour: 'ok' | 'throws' | 'errors', private readonly errorKind = 'network') {}

  start(): void {
    if (this.behaviour === 'throws') {
      throw new Error('NotAllowedError');
    }
    if (this.behaviour === 'errors') {
      // Assíncrono, como o navegador a sério: o erro chega depois do start().
      queueMicrotask(() => this.onerror?.({ error: this.errorKind }));
    }
  }

  stop(): void {
    this.onend?.();
  }
}

function withGlobalRecognition(factory: () => FakeRecognition): () => void {
  const original = (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = function (
    this: unknown,
  ) {
    return factory();
  };
  return () => {
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = original;
  };
}

describe('VoiceService — código do erro', () => {
  let restore: () => void;

  afterEach(() => {
    restore?.();
  });

  it('um start() que rebenta de forma síncrona chega ao onError, não fica em silêncio', async () => {
    restore = withGlobalRecognition(() => new FakeRecognition('throws'));
    const service = new VoiceService();
    const onError = vi.fn();

    // A decisão entre o reconhecimento local e o nativo (ver `startListening`)
    // pergunta primeiro ao serviço local — por isso já não há um resultado
    // síncrono a testar aqui, só o `onError` a chegar depois.
    service.toggleListening({ onTranscript: vi.fn(), onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError).toHaveBeenCalledWith('NotAllowedError');
  });

  it('o código do erro do navegador (ex.: "network") chega tal e qual, sem se inventar outro', async () => {
    restore = withGlobalRecognition(() => new FakeRecognition('errors', 'network'));
    const service = new VoiceService();
    const onError = vi.fn();

    service.toggleListening({ onTranscript: vi.fn(), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith('network');
  });

  it('not-allowed chega distinto de network — são arranjos diferentes', async () => {
    restore = withGlobalRecognition(() => new FakeRecognition('errors', 'not-allowed'));
    const service = new VoiceService();
    const onError = vi.fn();

    service.toggleListening({ onTranscript: vi.fn(), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith('not-allowed');
  });

  it('sem construtor nenhum no browser, nem chega a tentar', () => {
    restore = () => undefined;

    const service = new VoiceService();
    expect(service.isRecognitionSupported).toBe(false);
  });
});
