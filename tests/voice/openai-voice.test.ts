import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

class AudioTeste {
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => { this.onplay?.(); });
}

const audios: AudioTeste[] = [];

beforeEach(() => {
  audios.length = 0;
  vi.stubGlobal('Audio', class extends AudioTeste {
    constructor() { super(); audios.push(this); }
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['wav']), {
    headers: { 'Content-Type': 'audio/wav' },
  })));
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('voz OpenAI', () => {
  it('pede apenas o texto a dizer, com instruções pt-BR e sem alterar o reconhecimento', async () => {
    const service = new VoiceService();
    service.configureOpenAi('chave-de-teste');
    const onEnd = vi.fn();
    service.speak('Oi, Anderson. Tudo bem? Vamos começar; estou aqui...', { onEnd }, { kind: 'openai', voice: 'cedar' });
    await vi.waitFor(() => expect(audios).toHaveLength(1));
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(typeof options?.body).toBe('string');
    const body = JSON.parse(options?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ voice: 'cedar', response_format: 'wav' });
    expect(body.input).toBe('Oi, Anderson. Tudo bem? Vamos começar; estou aqui...');
    expect(body.instructions).toContain('português brasileiro');
    expect(body).not.toHaveProperty('audio');
    audios[0]!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(service.isSpeaking).toBe(false);
  });

  it('aceita reconhecimento local instalado mas ainda frio, sem exigir síntese', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true, sintese_local: false, reconhecimento_carregado: false,
      reconhecimento_disponivel: true,
    }), { headers: { 'Content-Type': 'application/json' } }));
    expect(await new VoiceService().localSttReachable()).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toMatch(/\/health$/);
  });

  it('sem chave, termina com explicação e sem pedir rede ou voz robótica', async () => {
    const service = new VoiceService();
    const onEnd = vi.fn();
    const onError = vi.fn();
    service.onOpenAiVoiceError = onError;
    service.speak('Oi.', { onEnd }, { kind: 'openai', voice: 'cedar' });
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
    expect(fetch).not.toHaveBeenCalled();
    expect(audios).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/chave/i));
  });

  it('cancelar aborta o pedido e a resposta tardia não toca nem liberta a fala seguinte', async () => {
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const service = new VoiceService();
    service.configureOpenAi('chave-de-teste');
    const onEnd = vi.fn();
    service.speak('Primeira.', { onEnd }, { kind: 'openai', voice: 'cedar' });
    const signal = vi.mocked(fetch).mock.calls[0]![1]!.signal!;
    service.stopSpeaking();
    expect(signal.aborted).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    service.speak('Segunda.', undefined, { kind: 'openai', voice: 'marin' });
    await vi.waitFor(() => expect(audios).toHaveLength(1));
    finish(new Response(new Blob(['antiga']), { headers: { 'Content-Type': 'audio/wav' } }));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(audios).toHaveLength(1);
    expect(service.isSpeaking).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    service.stopSpeaking();
  });

  it('quota esgotada avisa sem repetir pedidos nem reiniciar o Whisper', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 429 }));
    const service = new VoiceService();
    service.configureOpenAi('chave-de-teste');
    const restart = vi.fn();
    service.onCloneServiceNeedsRestart = restart;
    const onError = vi.fn();
    service.onOpenAiVoiceError = onError;
    service.speak('Oi.', undefined, { kind: 'openai', voice: 'cedar' });
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/limite|saldo/i));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(restart).not.toHaveBeenCalled();
  });
});
