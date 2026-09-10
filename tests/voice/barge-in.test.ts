import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Barge-in (Parte 7.2 §Voz): o utilizador, a meio da resposta, quer falar por
 * cima — e o assistente deve parar já e ouvir, não continuar a falar até ao
 * fim para só depois ligar o microfone.
 *
 * O guard de eco (`'a-falar'` em `toggleListening`) continua a valer para o
 * re-engate automático do modo conversa — é isso que evita o microfone ouvir
 * a própria voz do JARVIS como se fosse um pedido. Mas uma pessoa a carregar
 * no microfone à mão nunca devia receber esse erro: é o caminho do `bargeIn`.
 */

/** Um `Audio` de mentira, que regista as instâncias para se inspecionar `pause()`. */
class FakeAudio {
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly pause = vi.fn();

  constructor(public readonly src: string) {}

  play(): Promise<void> {
    this.onplay?.();
    return Promise.resolve();
  }
}

function withFakeAudio(): { audios: FakeAudio[]; restore: () => void } {
  const audios: FakeAudio[] = [];
  const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  (globalThis as unknown as { Audio: unknown }).Audio = class extends FakeAudio {
    constructor(src: string) {
      super(src);
      audios.push(this);
    }
  };

  return {
    audios,
    restore: () => {
      (globalThis as unknown as { Audio?: unknown }).Audio = originalAudio;
    },
  };
}

/** Um `SpeechRecognition` de mentira, para a escuta nativa arrancar sem rede. */
class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  start(): void {}
  stop(): void {
    this.onend?.();
  }
}

function withGlobalRecognition(): () => void {
  const original = (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = function (
    this: unknown,
  ) {
    return new FakeRecognition();
  };
  return () => {
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = original;
  };
}

describe('bargeIn — interromper a fala para ouvir', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** `fetch` que serve áudio no `/falar` e um serviço local sem reconhecimento carregado. */
  function comServicoLocal(): void {
    global.fetch = vi.fn((url: unknown) => {
      if (String(url).endsWith('/falar')) {
        return Promise.resolve(new Response(new Blob(['audio-a-fingir']), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ reconhecimento_carregado: false }), { status: 200 }),
      );
    });
  }

  it('durante a fala clonada, para o áudio (pause) e dispara o onEnd da fala cortada', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste');
    vi.spyOn(URL, 'revokeObjectURL');
    const env = withFakeAudio();
    restore = () => {
      env.restore();
      withGlobalRecognition();
    };
    withGlobalRecognition();
    comServicoLocal();

    const service = new VoiceService();
    const onEnd = vi.fn();
    service.speak('Bom dia, Anderson.', { onEnd }, { kind: 'clonada', nome: null });

    // Espera a fala clonada ter o áudio pronto (cloneAudio criado).
    await vi.waitFor(() => expect(env.audios.length).toBe(1));
    expect(service.isSpeaking).toBe(true);

    service.bargeIn({ onTranscript: vi.fn(), onError: vi.fn() });

    expect(env.audios[0]?.pause).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(service.isListening).toBe(true);
  });

  it('sem fala em curso, liga a escuta e devolve true', () => {
    restore = withGlobalRecognition();
    comServicoLocal();

    const service = new VoiceService();
    const resultado = service.bargeIn({ onTranscript: vi.fn(), onError: vi.fn() });

    expect(resultado).toBe(true);
    expect(service.isListening).toBe(true);
  });

  it('se já estiver a ouvir, desliga a escuta em vez de arrancar uma segunda', () => {
    restore = withGlobalRecognition();
    comServicoLocal();

    const service = new VoiceService();
    service.bargeIn({ onTranscript: vi.fn(), onError: vi.fn() });
    expect(service.isListening).toBe(true);

    const resultado = service.bargeIn({ onTranscript: vi.fn(), onError: vi.fn() });

    expect(resultado).toBe(false);
    expect(service.isListening).toBe(false);
  });

  it('toggleListening mantém o guard de eco — a meio da fala continua a recusar com a-falar', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste');
    const env = withFakeAudio();
    restore = env.restore;
    comServicoLocal();

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'clonada', nome: null });
    await vi.waitFor(() => expect(env.audios.length).toBe(1));

    const onError = vi.fn();
    const resultado = service.toggleListening({ onTranscript: vi.fn(), onError });

    expect(resultado).toBe(false);
    expect(onError).toHaveBeenCalledWith('a-falar');
  });
});
