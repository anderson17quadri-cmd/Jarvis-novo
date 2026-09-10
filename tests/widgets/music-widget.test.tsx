import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import MusicWidget from '@/widgets/music/MusicWidget';
import { musicService } from '@/services/music/music-service';
import { MockMusicProvider, type MusicProvider } from '@/services/music/providers/music-provider';
import { useMusicStore } from '@/stores/use-music-store';

class FailingMusicProvider implements MusicProvider {
  readonly id = 'failing';
  readonly name = 'Falha';
  isConfigured(): boolean {
    return true;
  }
  getState(): Promise<never> {
    return Promise.reject(new Error('sem acesso'));
  }
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): Promise<void> {
    return Promise.resolve();
  }
  next(): Promise<void> {
    return Promise.resolve();
  }
  previous(): Promise<void> {
    return Promise.resolve();
  }
  seek(): Promise<void> {
    return Promise.resolve();
  }
  setVolume(): Promise<void> {
    return Promise.resolve();
  }
  toggleShuffle(): Promise<void> {
    return Promise.resolve();
  }
  toggleRepeat(): Promise<void> {
    return Promise.resolve();
  }
}

beforeEach(() => {
  useMusicStore.setState({ snapshot: null, isLoading: true, error: null });
});

afterEach(() => {
  musicService.setProvider(new MockMusicProvider());
});

describe('widget de Música — erro não fica em silêncio', () => {
  it('sem nenhuma leitura boa ainda, uma falha mostra o estado de erro', async () => {
    musicService.setProvider(new FailingMusicProvider());

    render(<MusicWidget />);

    expect(await screen.findByText('Não consegui ler o estado da música.')).toBeInTheDocument();
  });
});
