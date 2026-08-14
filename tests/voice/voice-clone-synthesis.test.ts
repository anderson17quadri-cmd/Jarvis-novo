import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Voz clonada — síntese e reprodução no lado cliente (revisão a sério,
 * 14/08/2026). O `speakClonada` pede áudio ao serviço local, cria uma blob
 * URL e toca-a num `Audio`. Nunca tinha sido revisto por ninguém de fora, e
 * o caminho de falha tinha dois buracos reais:
 *
 * 1. Se `audio.play()` recusasse (política de autoplay, ou áudio ilegível),
 *    a blob URL acabada de criar nunca era revogada — o `catch` só fazia
 *    `onSpeechEnd` + `onEnd`. O `cloneAudio` ficava a apontar para um áudio
 *    que já não ia tocar, e a URL ficava órfã até a página fechar (o mesmo
 *    defeito que a variável `cloneAudio` existe para evitar, no comentário
 *    em `voice-service.ts`).
 * 2. Se o `fetch` falhasse com uma fala anterior ainda a tocar, essa fala
 *    antiga continuava a soar — mas `onSpeechEnd` já tinha libertado o
 *    microfone, ou seja, ficava um "a falar" sem ninguém a guardar o eco.
 *
 * Prova-se aqui que, em qualquer um dos dois casos, o áudio anterior é
 * parado (`pause`) e a sua URL revogada.
 */

/** Um `Audio` de mentira, que se pode obrigar a recusar o `play()` — o caso
 *  real do autoplay bloqueado. Regista as instâncias criadas para se poder
 *  inspecionar `pause()` depois. */
class FakeAudio {
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly pause = vi.fn();

  constructor(
    public readonly src: string,
    private readonly recusaPlay: boolean,
  ) {}

  play(): Promise<void> {
    if (this.recusaPlay) {
      return Promise.reject(new Error('NotAllowedError: a reprodução foi bloqueada'));
    }
    this.onplay?.();
    return Promise.resolve();
  }
}

/** Troca o `Audio` global por `FakeAudio` e recolhe as instâncias criadas. */
function withFakeAudio(recusaPlay: boolean): { audios: FakeAudio[]; restore: () => void } {
  const audios: FakeAudio[] = [];
  const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  (globalThis as unknown as { Audio: unknown }).Audio = class extends FakeAudio {
    constructor(src: string) {
      super(src, recusaPlay);
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

describe('voz clonada — falha na reprodução no lado cliente', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
  });

  it('se audio.play() recusar (autoplay), a blob URL criada é revogada na mesma', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL');
    const revogar = vi.spyOn(URL, 'revokeObjectURL');
    const env = withFakeAudio(true);
    restore = env.restore;

    global.fetch = vi.fn(() => Promise.resolve(new Response(new Blob(['audio-a-fingir']), { status: 200 })));

    const service = new VoiceService();
    service.speak('Bom dia', undefined, { kind: 'clonada', nome: null });

    await vi.waitFor(() => expect(revogar).toHaveBeenCalledTimes(1));
    expect(revogar).toHaveBeenCalledWith(criar.mock.results[0]?.value);
  });

  it('se o pedido ao serviço local falhar, a fala anterior é parada — não continua a soar sem guarda', async () => {
    const revogar = vi.spyOn(URL, 'revokeObjectURL');
    const env = withFakeAudio(false);
    restore = env.restore;

    let chamada = 0;
    global.fetch = vi.fn(() => {
      chamada += 1;
      if (chamada === 1) {
        return Promise.resolve(new Response(new Blob(['primeira-fala']), { status: 200 }));
      }
      return Promise.reject(new Error('serviço local em baixo'));
    });

    const service = new VoiceService();
    service.speak('Primeira', undefined, { kind: 'clonada', nome: null });
    await vi.waitFor(() => expect(env.audios.length).toBe(1));

    // A segunda fala falha a pedir o áudio — mas a primeira continuava a
    // tocar. Deve parar-se e revogar-se a sua URL.
    service.speak('Segunda', undefined, { kind: 'clonada', nome: null });
    await vi.waitFor(() => expect(revogar).toHaveBeenCalled());

    expect(env.audios[0]?.pause).toHaveBeenCalled();
  });

  it('stopSpeaking() a meio do áudio clonado dispara o onEnd — o pause() nunca dispara onended', async () => {
    // O `pause()` do `HTMLAudioElement` não dispara `onended` — por isso
    // parar a fala clonada a meio nunca ia passar pelo `onended` que chama
    // o `onEnd` do chamador. Sem o `stopSpeaking` disparar o `onEnd`, quem
    // usa esse callback para mudar de estado ficava preso em "a falar".
    const env = withFakeAudio(false);
    restore = env.restore;

    global.fetch = vi.fn(() => Promise.resolve(new Response(new Blob(['audio-a-fingir']), { status: 200 })));

    const service = new VoiceService();
    const onEnd = vi.fn();
    service.speak('Bom dia', { onStart: vi.fn(), onEnd }, { kind: 'clonada', nome: null });

    await vi.waitFor(() => expect(env.audios.length).toBe(1));

    service.stopSpeaking();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(env.audios[0]?.pause).toHaveBeenCalled();
  });
});

/**
 * Achado ao vivo pelo utilizador (14/08/2026): com a voz clonada escolhida
 * (o histórico mostra "Alison Dietlinde" como voz por omissão) e o serviço
 * local desligado — é um processo à parte, `voice-clone-service/run.ps1`,
 * fácil de esquecer de arrancar — o assistente ficava **completamente
 * mudo**: sem som, sem erro, sem aviso nenhum. O `catch` do `speakClonada`
 * fazia só `onSpeechEnd` + `onEnd`, e o silêncio parecia a app partida.
 *
 * Nenhum teste apanhava isto porque todos simulam o `fetch` a responder —
 * o caminho do serviço em baixo nunca era exercitado até ao fim.
 */
describe('voz clonada — serviço local em baixo não pode deixar o assistente mudo', () => {
  let restore: () => void;
  const originalFetch = global.fetch;

  afterEach(() => {
    restore?.();
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  /** Substitui a síntese do sistema por um duplo que regista o que lhe pedem. */
  function comSinteseDoSistema(): { faladas: string[] } {
    const faladas: string[] = [];

    class FakeUtterance {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      voice: unknown = null;
      lang = '';
      rate = 1;
      pitch = 1;
      constructor(public readonly text: string) {}
    }

    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      getVoices: () => [],
      speak: (utterance: FakeUtterance) => {
        faladas.push(utterance.text);
        utterance.onstart?.();
      },
    });

    return { faladas };
  }

  it('cai para a voz do sistema em vez de ficar em silêncio', async () => {
    const env = withFakeAudio(false);
    restore = env.restore;
    const sistema = comSinteseDoSistema();

    global.fetch = vi.fn(() => Promise.reject(new Error('serviço local em baixo')));

    const service = new VoiceService();
    service.speak('Bom dia, Anderson.', undefined, { kind: 'clonada', nome: null });

    // Sem a correção, isto nunca acontece — nada é falado, por nada. O texto
    // chega já passado por `limparParaSintese` (que tira a pontuação final).
    await vi.waitFor(() => expect(sistema.faladas).toEqual(['Bom dia, Anderson']));
    expect(env.audios.length).toBe(0);
  });

  it('avisa uma vez que a voz clonada não está disponível, para o silêncio ter explicação', async () => {
    const env = withFakeAudio(false);
    restore = env.restore;
    comSinteseDoSistema();

    global.fetch = vi.fn(() => Promise.reject(new Error('serviço local em baixo')));

    const service = new VoiceService();
    const avisar = vi.fn();
    service.onCloneServiceUnavailable = avisar;

    service.speak('Olá', undefined, { kind: 'clonada', nome: null });

    await vi.waitFor(() => expect(avisar).toHaveBeenCalled());
    expect(service.isCloneServiceUnavailable).toBe(true);
  });

  it('o onEnd do chamador dispara na mesma quando nem o sistema tem síntese', async () => {
    const env = withFakeAudio(false);
    restore = env.restore;

    // Sem `speechSynthesis` nenhum: o caminho de último recurso.
    vi.stubGlobal('speechSynthesis', undefined);
    global.fetch = vi.fn(() => Promise.reject(new Error('serviço local em baixo')));

    const service = new VoiceService();
    const onEnd = vi.fn();
    service.speak('Olá', { onEnd }, { kind: 'clonada', nome: null });

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });
});
