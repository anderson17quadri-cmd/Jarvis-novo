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
const sockets: SocketTeste[] = [];
class SocketTeste {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  close = vi.fn(() => { this.readyState = 3; });
  constructor(readonly url: string, readonly protocols: string[]) {
    sockets.push(this);
    setTimeout(() => this.emit({ type: 'session.created' }), 0);
  }
  emit(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
  send(data: string): void {
    const message = JSON.parse(data) as Record<string, unknown>;
    this.sent.push(message);
    if (message.type === 'response.create') {
      this.emit({ type: 'response.output_audio.delta', delta: 'AAAAAA==' });
      this.emit({ type: 'response.done', response: { status: 'completed' } });
    }
  }
}

beforeEach(() => {
  audios.length = 0;
  sockets.length = 0;
  vi.stubGlobal('WebSocket', SocketTeste);
  vi.stubGlobal('Audio', class extends AudioTeste {
    constructor() { super(); audios.push(this); }
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ value: 'ek_teste' }), {
    headers: { 'Content-Type': 'application/json' },
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
    expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(typeof options?.body).toBe('string');
    const body = JSON.parse(options?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ session: {
      model: 'gpt-realtime-2.1-mini', audio: { input: { turn_detection: null },
        output: { voice: 'cedar', format: { type: 'audio/pcm', rate: 24000 } } },
    } });
    expect(sockets[0]!.protocols).toEqual(['realtime', 'openai-insecure-api-key.ek_teste']);
    expect(sockets[0]!.url).not.toContain('chave-de-teste');
    expect(sockets[0]!.sent[0]).toMatchObject({ type: 'response.create', response: {
      conversation: 'none', input: [{ content: [{ text: 'Oi, Anderson. Tudo bem? Vamos começar; estou aqui...' }] }],
      tools: [],
    } });
    expect((sockets[0]!.sent[0] as { response: { instructions: string } }).response.instructions).toContain('português brasileiro');
    expect(sockets[0]!.close).toHaveBeenCalledTimes(1);
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
    finish(new Response(JSON.stringify({ value: 'ek_antiga' }), { headers: { 'Content-Type': 'application/json' } }));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(audios).toHaveLength(1);
    expect(service.isSpeaking).toBe(true);
    expect(sockets).toHaveLength(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    service.stopSpeaking();
  });

  it('parar durante a geração fecha a sessão sem reproduzir áudio parcial', async () => {
    vi.spyOn(SocketTeste.prototype, 'send').mockImplementation(function (this: SocketTeste) {});
    const service = new VoiceService();
    service.configureOpenAi('teste');
    const onEnd = vi.fn();
    service.speak('Oi.', { onEnd }, { kind: 'openai', voice: 'cedar' });
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    service.stopSpeaking();
    expect(sockets[0]!.close).toHaveBeenCalledTimes(1);
    sockets[0]!.emit({ type: 'response.output_audio.delta', delta: 'AAAAAA==' });
    expect(audios).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
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
