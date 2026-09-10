import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Leitura natural (Parte 7.1 §Voz) — dois lados, ambos achados ao vivo
 * (14/08/2026) quando o utilizador disse que a voz "lia muito devagar, com
 * pausas":
 *
 * 1. **Ritmo.** O XTTS-v2 sai deliberado de mais para conversa. O `speakClonada`
 *    manda `velocidade` no corpo do `/falar`, e o serviço passa isso ao
 *    `speed` do modelo.
 * 2. **Pausas entre frases.** Cada frase pagava a latência da síntese
 *    (5–9 s) à vez. O `prefetchClonada` sintetiza a frase seguinte *enquanto*
 *    a atual toca, para o `speak` seguinte a achar o áudio pronto — e só
 *    pagar o custo uma vez.
 *
 * E a pontuação: ler "ponto" em voz alta é ridículo — o `limparParaSintese`
 * troca os pontos por vírgulas (pausa natural) antes de mandar para o modelo.
 */

/** Um `Audio` de mentira que regista as instâncias para se inspecionar `pause()`. */
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

describe('voz clonada — pré-síntese da frase seguinte', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** `fetch` que conta os pedidos ao `/falar` e serve áudio, sempre. */
  function comServicoDeFalar(): { falarPedidos: number } {
    const estado = { falarPedidos: 0 };
    global.fetch = vi.fn((url: unknown) => {
      if (String(url).endsWith('/falar')) {
        estado.falarPedidos += 1;
        return Promise.resolve(new Response(new Blob(['audio-a-fingir']), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ reconhecimento_carregado: false }), { status: 200 }),
      );
    });
    return estado;
  }

  it('o speak seguinte usa a pré-síntese já pronta — um único /falar, não dois', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prefetch');
    vi.spyOn(URL, 'revokeObjectURL');
    const env = withFakeAudio();
    restore = env.restore;
    const estado = comServicoDeFalar();

    const service = new VoiceService();
    service.setSelection({ kind: 'clonada', nome: null });

    service.prefetchClonada('Segunda frase.');
    // Espera a pré-síntese concluir: o `createObjectURL` só corre no fim da
    // cadeia de microtarefas (fetch → blob → URL), e o `.then` que guarda a
    // URL pronta corre logo a seguir — antes do próximo macrotask do `waitFor`.
    // Esperar por `falarPedidos` não servia: o mock conta o pedido de forma
    // síncrona, antes de qualquer `await`, e o teste avançava cedo de mais.
    await vi.waitFor(() => expect(criar).toHaveBeenCalledTimes(1));

    // O `speak` limpa a pontuação antes de pedir — a chave é "Segunda frase",
    // a mesma que o prefetch guardou sob a frase limpa.
    service.speak('Segunda frase.', undefined);
    await vi.waitFor(() => expect(env.audios.length).toBe(1));

    expect(estado.falarPedidos).toBe(1);
  });

  it('com voz do sistema, prefetchClonada não pede nada — não há latência a esconder', () => {
    restore = () => undefined;
    const estado = comServicoDeFalar();

    const service = new VoiceService();
    service.setSelection({ kind: 'sistema', voiceURI: 'pt-PT' });

    service.prefetchClonada('Uma frase.');

    expect(estado.falarPedidos).toBe(0);
  });
});

describe('voz clonada — leitura natural (pontuação e velocidade)', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('troca os pontos por vírgulas e manda velocidade no pedido /falar', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste');
    const env = withFakeAudio();
    restore = env.restore;

    let corpo: Record<string, unknown> = {};
    global.fetch = vi.fn((url: unknown, opcoes?: RequestInit) => {
      if (String(url).endsWith('/falar')) {
        corpo = JSON.parse(
          typeof opcoes?.body === 'string' ? opcoes.body : '{}',
        ) as Record<string, unknown>;
        return Promise.resolve(new Response(new Blob(['audio']), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ reconhecimento_carregado: false }), { status: 200 }),
      );
    });

    const service = new VoiceService();
    service.speak('Ponto. Vírgula. Fim.', undefined, { kind: 'clonada', nome: null });
    await vi.waitFor(() => expect(env.audios.length).toBe(1));

    expect(corpo.texto).toBe('Ponto, Vírgula, Fim');
    expect(corpo.velocidade).toBeGreaterThan(1);
  });
});
