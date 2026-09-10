import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O provedor de música local fala com o Rust por `musicSetRoot`/`musicReadDir`
 * e reproduz num `<audio>` a sério. Estes testes trocam o adapter por um falso
 * que regista as chamadas e substituem o `Audio` global por um esqueleto — sem
 * IPC, sem disco, sem codec.
 */
const mocks = vi.hoisted(() => ({
  musicSetRoot: vi.fn(),
  musicReadDir: vi.fn(),
  toLocalMediaUrl: vi.fn(),
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    musicSetRoot: mocks.musicSetRoot,
    musicReadDir: mocks.musicReadDir,
    toLocalMediaUrl: mocks.toLocalMediaUrl,
  }),
}));

import { LocalMusicProvider } from '@/services/music/providers/local-music-provider';

class FakeAudio {
  src = '';
  volume = 1;
  currentTime = 0;
  duration = 0;
  onended: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
}

beforeEach(() => {
  mocks.musicSetRoot.mockReset();
  mocks.musicReadDir.mockReset();
  mocks.toLocalMediaUrl.mockReset();

  mocks.musicSetRoot.mockResolvedValue({ path: 'C:/Musica', name: 'Musica' });
  mocks.toLocalMediaUrl.mockImplementation((path: string) => `asset://localhost/${path}`);

  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LocalMusicProvider — configuração', () => {
  it('sem pasta não está configurado', () => {
    expect(new LocalMusicProvider('', '').isConfigured()).toBe(false);
    expect(new LocalMusicProvider('   ', '').isConfigured()).toBe(false);
  });

  it('com pasta está configurado', () => {
    expect(new LocalMusicProvider('C:/Musica', 'Musica').isConfigured()).toBe(true);
  });
});

describe('LocalMusicProvider — ler', () => {
  it('declara a raiz e lista os ficheiros como faixas', async () => {
    mocks.musicReadDir.mockResolvedValue([
      { name: 'faixa-um.mp3', path: 'C:/Musica/faixa-um.mp3' },
      { name: 'faixa-dois.flac', path: 'C:/Musica/faixa-dois.flac' },
    ]);

    const state = await new LocalMusicProvider('C:/Musica', 'Musica').getState();

    expect(mocks.musicSetRoot).toHaveBeenCalledWith('C:/Musica');
    expect(mocks.musicReadDir).toHaveBeenCalled();
    expect(state.isSimulated).toBe(false);
    expect(state.queueLength).toBe(2);
    expect(state.track?.title).toBe('faixa-um');
    expect(state.track?.artist).toBe('Musica');
  });

  it('sem ficheiros de áudio, devolve sem faixa', async () => {
    mocks.musicReadDir.mockResolvedValue([]);

    const state = await new LocalMusicProvider('C:/Musica', 'Musica').getState();

    expect(state.track).toBeNull();
    expect(state.queueLength).toBe(0);
  });

  it('se a pasta desapareceu, devolve sem faixa em vez de rebentar', async () => {
    mocks.musicSetRoot.mockResolvedValue(null);

    const state = await new LocalMusicProvider('C:/Musica', 'Musica').getState();

    expect(state.track).toBeNull();
  });

  it('a duração corrigida aparece na mesma chamada em que o metadata chega, não só na seguinte', async () => {
    mocks.musicReadDir.mockResolvedValue([
      { name: 'faixa-um.mp3', path: 'C:/Musica/faixa-um.mp3' },
    ]);

    const provider = new LocalMusicProvider('C:/Musica', 'Musica');
    const firstState = await provider.getState();
    expect(firstState.track?.durationSec).toBe(0);

    // Simula o `loadedmetadata` do browser a chegar entre duas sondagens —
    // o elemento de áudio real dispararia isto sozinho; aqui só se muda o
    // valor que o `<audio>` falso devolve.
    (provider as unknown as { audio: { duration: number } }).audio.duration = 180;

    const secondState = await provider.getState();
    expect(secondState.track?.durationSec).toBe(180);
  });
});

describe('LocalMusicProvider — reprodução', () => {
  it('tocar carrega o ficheiro no elemento de áudio', async () => {
    mocks.musicReadDir.mockResolvedValue([
      { name: 'faixa-um.mp3', path: 'C:/Musica/faixa-um.mp3' },
    ]);

    const provider = new LocalMusicProvider('C:/Musica', 'Musica');
    await provider.play();

    const state = await provider.getState();
    expect(state.status).toBe('playing');
    expect(mocks.toLocalMediaUrl).toHaveBeenCalledWith('C:/Musica/faixa-um.mp3');
  });

  it('pausar passa a pausado', async () => {
    mocks.musicReadDir.mockResolvedValue([
      { name: 'faixa-um.mp3', path: 'C:/Musica/faixa-um.mp3' },
    ]);

    const provider = new LocalMusicProvider('C:/Musica', 'Musica');
    await provider.play();
    await provider.pause();

    expect((await provider.getState()).status).toBe('paused');
  });

  it('seguinte avança de faixa', async () => {
    mocks.musicReadDir.mockResolvedValue([
      { name: 'um.mp3', path: 'C:/Musica/um.mp3' },
      { name: 'dois.mp3', path: 'C:/Musica/dois.mp3' },
    ]);

    const provider = new LocalMusicProvider('C:/Musica', 'Musica');
    await provider.next();

    const state = await provider.getState();
    expect(state.queueIndex).toBe(1);
    expect(state.track?.title).toBe('dois');
  });

  it('o volume fica entre 0 e 1', async () => {
    mocks.musicReadDir.mockResolvedValue([
      { name: 'um.mp3', path: 'C:/Musica/um.mp3' },
    ]);

    const provider = new LocalMusicProvider('C:/Musica', 'Musica');
    await provider.setVolume(1.7);

    expect((await provider.getState()).volume).toBe(1);
  });
});
