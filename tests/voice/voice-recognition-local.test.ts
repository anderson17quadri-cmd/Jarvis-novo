import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Reconhecimento local (`voice-clone-service/`, `POST /ouvir`) — o arranjo
 * real para o WebView2, ver `tests/voice/voice-service.test.ts` para o
 * diagnóstico do nativo partido. Aqui testa-se o caminho que substitui,
 * incluindo a deteção de silêncio (Parte 7.2 §Pipeline completo).
 */

class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-a-fingir'], { type: 'audio/webm' }) });
    this.onstop?.();
  }

  static isTypeSupported(): boolean {
    return true;
  }
}

/** Controla o que a `AnalyserNode` de mentira "ouve" a cada 100ms. */
let volumeAtual: 'fala' | 'silencio' = 'silencio';

class FakeAnalyserNode {
  fftSize = 2_048;
  connect = vi.fn();

  getByteTimeDomainData(array: Uint8Array): void {
    // 128 é o "zero" do sinal (sem som); mais longe disso é mais volume.
    array.fill(volumeAtual === 'fala' ? 200 : 128);
  }
}

class FakeAudioContext {
  createMediaStreamSource(): { connect: () => void } {
    return { connect: vi.fn() };
  }

  createAnalyser(): FakeAnalyserNode {
    return new FakeAnalyserNode();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function fakeStream(): MediaStream {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track] } as unknown as MediaStream;
}

function withLocalRecognitionEnv(): () => void {
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  const originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext;

  volumeAtual = 'silencio';

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.resolve(fakeStream())) },
  });
  (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;

  return () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
    (window as unknown as { MediaRecorder?: unknown }).MediaRecorder = originalMediaRecorder;
    (window as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  };
}

describe('VoiceService — reconhecimento local (POST /ouvir)', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('com o serviço local disponível, usa /ouvir em vez do reconhecimento nativo', async () => {
    restore = withLocalRecognitionEnv();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = urlDe(input);
      if (url.includes('/health')) {
        return Promise.resolve(
          new Response(JSON.stringify({ reconhecimento_carregado: true }), { status: 200 }),
        );
      }
      if (url.includes('/ouvir')) {
        return Promise.resolve(new Response(JSON.stringify({ texto: 'abre os emails' }), { status: 200 }));
      }
      return Promise.reject(new Error(`pedido inesperado: ${url}`));
    });

    const service = new VoiceService();
    const onTranscript = vi.fn();
    const onEnd = vi.fn();
    const onStart = vi.fn();

    service.toggleListening({ onTranscript, onEnd, onStart });

    // Parar à mão, como se se tivesse voltado a carregar no botão — sem
    // isso, só o limite de segurança (12s) ou o silêncio param a gravação,
    // e este teste não é sobre nenhum dos dois (ver o teste a seguir).
    // Esperar por `onStart`, não só por `isListening`: este último já é
    // `true` antes de a gravação chegar a arrancar a sério (getUserMedia e
    // o pedido a `/health` ainda não resolveram).
    await vi.waitFor(() => expect(onStart).toHaveBeenCalled());
    service.stopListening();

    await vi.waitFor(() => expect(onTranscript).toHaveBeenCalledWith('abre os emails'));
    expect(onEnd).toHaveBeenCalled();
  });

  it('deteta o silêncio depois de fala a sério, e não espera o limite de segurança', async () => {
    vi.useFakeTimers();
    restore = withLocalRecognitionEnv();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = urlDe(input);
      if (url.includes('/health')) {
        return Promise.resolve(
          new Response(JSON.stringify({ reconhecimento_carregado: true }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ texto: 'liga o wifi' }), { status: 200 }));
    });

    const service = new VoiceService();
    const onTranscript = vi.fn();

    service.toggleListening({ onTranscript });

    // Deixa o `localSttReachable` (fetch real, sem temporizador) resolver.
    await vi.advanceTimersByTimeAsync(50);

    volumeAtual = 'fala';
    await vi.advanceTimersByTimeAsync(500); // > minFalaMs (300ms)

    volumeAtual = 'silencio';
    await vi.advanceTimersByTimeAsync(2_100); // > silencioMs (2000ms) — corta aqui, não aos 20s

    expect(onTranscript).toHaveBeenCalledWith('liga o wifi');
  });
});
