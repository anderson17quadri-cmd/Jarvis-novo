import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Gravar a amostra da própria voz na interface (Parte 7.1 §Voz clonada
 * local, sub-fase 4.2) — `POST /voz` já não exige um `.wav` colado à mão.
 */

/** Um `MediaRecorder` de mentira — jsdom não implementa nenhum a sério. */
class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, private readonly comAudio: boolean) {}

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    if (this.comAudio) {
      this.ondataavailable?.({ data: new Blob(['audio-a-fingir'], { type: 'audio/webm' }) });
    }
    this.onstop?.();
  }

  static isTypeSupported(): boolean {
    return true;
  }
}

function fakeStream(): MediaStream {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track] } as unknown as MediaStream;
}

function withRecordingEnv(options: { getUserMediaError?: Error; comAudio?: boolean } = {}): () => void {
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() =>
        options.getUserMediaError ? Promise.reject(options.getUserMediaError) : Promise.resolve(fakeStream()),
      ),
    },
  });

  (window as unknown as { MediaRecorder: unknown }).MediaRecorder = class extends FakeMediaRecorder {
    constructor(stream: MediaStream) {
      super(stream, options.comAudio ?? true);
    }
  };

  return () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
    (window as unknown as { MediaRecorder?: unknown }).MediaRecorder = originalMediaRecorder;
  };
}

describe('VoiceService — gravar a amostra da voz (POST /voz)', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('grava, para ao fim do limite, e manda ao serviço local', async () => {
    restore = withRecordingEnv();
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, bytes: 123 }), { status: 200 })),
    );

    const service = new VoiceService();
    const handle = service.recordVoiceSample(50);
    const resultado = await handle.result;

    expect(resultado).toEqual({ ok: true, bytes: 123 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/voz',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('stop() termina mais cedo do que o limite máximo', async () => {
    restore = withRecordingEnv();
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, bytes: 9 }), { status: 200 })),
    );

    const service = new VoiceService();
    const handle = service.recordVoiceSample(60_000);

    // Sem o stop(), isto só resolveria ao fim de 60s — o teste teria de
    // esperar isso, ou usar temporizadores falsos. Chamar stop() já é o que
    // se está a testar: que não é preciso esperar o limite todo.
    await new Promise((resolve) => setTimeout(resolve, 10));
    handle.stop();

    const resultado = await handle.result;
    expect(resultado).toEqual({ ok: true, bytes: 9 });
  });

  it('sem permissão de microfone, chega o motivo — não fica em silêncio', async () => {
    restore = withRecordingEnv({ getUserMediaError: Object.assign(new Error(), { name: 'NotAllowedError' }) });

    const service = new VoiceService();
    const resultado = await service.recordVoiceSample(50).result;

    expect(resultado).toEqual({ ok: false, motivo: 'not-allowed' });
  });

  it('sem áudio nenhum gravado, não chega a chamar o serviço', async () => {
    restore = withRecordingEnv({ comAudio: false });
    global.fetch = vi.fn();

    const service = new VoiceService();
    const resultado = await service.recordVoiceSample(50).result;

    expect(resultado).toEqual({ ok: false, motivo: 'sem-audio' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('o serviço local a responder com erro chega com o detalhe, não um 500 genérico', async () => {
    restore = withRecordingEnv();
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: 'ficheiro vazio de mais' }), { status: 400 }),
      ),
    );

    const service = new VoiceService();
    const resultado = await service.recordVoiceSample(50).result;

    expect(resultado).toEqual({ ok: false, motivo: 'ficheiro vazio de mais' });
  });
});
