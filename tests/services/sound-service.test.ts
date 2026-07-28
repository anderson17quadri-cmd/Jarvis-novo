import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundService } from '@/services/sound-service';

/**
 * O jsdom não implementa a Web Audio API. O duplo abaixo regista as chamadas,
 * que é o que interessa verificar: que o serviço só toca quando deve, e que
 * nunca lança quando o browser não colabora.
 */
interface Recorder {
  readonly started: number[];
  readonly closed: () => boolean;
}

function installAudioStub(): Recorder {
  const started: number[] = [];
  let closed = false;

  class FakeAudioContext {
    currentTime = 0;
    state: AudioContextState = 'running';
    destination = {} as AudioDestinationNode;

    createOscillator(): OscillatorNode {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: () => undefined,
        start: (at: number) => started.push(at),
        stop: () => undefined,
      } as unknown as OscillatorNode;
    }

    createGain(): GainNode {
      return {
        gain: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: () => undefined,
      } as unknown as GainNode;
    }

    async close(): Promise<void> {
      closed = true;
    }

    async resume(): Promise<void> {
      this.state = 'running';
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { started, closed: () => closed };
}

let recorder: Recorder;
let service: SoundService;

beforeEach(() => {
  localStorage.clear();
  recorder = installAudioStub();
  service = new SoundService();
});

afterEach(() => {
  service.dispose();
  vi.unstubAllGlobals();
});

describe('serviço de som', () => {
  it('começa desligado — um sistema que apita sem ser pedido desliga-se uma vez só', async () => {
    await service.hydrate();
    expect(service.isEnabled).toBe(false);
  });

  it('desligado, não cria contexto de áudio nenhum', () => {
    service.play('click');
    expect(recorder.started).toHaveLength(0);
  });

  it('ligado, toca', () => {
    service.setEnabled(true);
    service.play('click');
    expect(recorder.started).toHaveLength(1);
  });

  it('um som composto agenda os tons em sequência, não em cima uns dos outros', () => {
    service.setEnabled(true);
    service.play('success');

    expect(recorder.started).toHaveLength(2);
    expect(recorder.started[1]).toBeGreaterThan(recorder.started[0]!);
  });

  it('desligar fecha o contexto em vez de o deixar aberto e mudo', () => {
    service.setEnabled(true);
    service.play('click');
    service.setEnabled(false);

    expect(recorder.closed()).toBe(true);
  });

  it('o volume fica entre 0 e 1, aconteça o que acontecer', () => {
    service.setVolume(5);
    expect(service.currentVolume).toBe(1);

    service.setVolume(-2);
    expect(service.currentVolume).toBe(0);
  });

  it('sem Web Audio, não toca nem rebenta', () => {
    vi.stubGlobal('AudioContext', undefined);
    service.setEnabled(true);

    expect(() => service.play('error')).not.toThrow();
  });

  it('um contexto que lança não parte a interação', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('recusado pelo browser');
        }
      },
    );
    service.setEnabled(true);

    expect(() => service.play('notify')).not.toThrow();
  });

  it('a preferência sobrevive a recarregar', async () => {
    service.setEnabled(true);
    service.setVolume(0.2);
    await service.persist();

    const outro = new SoundService();
    await outro.hydrate();

    expect(outro.isEnabled).toBe(true);
    expect(outro.currentVolume).toBeCloseTo(0.2);
  });
});
