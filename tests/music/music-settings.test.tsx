import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MusicSettings } from '@/apps/personalization/MusicSettings';
import { applyMusicSettings } from '@/hooks/use-music-settings';
import { MockMusicProvider } from '@/services/music/providers/music-provider';
import { musicService } from '@/services/music/music-service';
import { useMusicSettingsStore } from '@/stores/use-music-settings-store';
import { DEFAULT_MUSIC_SETTINGS } from '@/types/music-settings';

/**
 * A música local fala com o Rust por `musicSetRoot`/`musicReadDir`, expostos no
 * adapter. Estes testes trocam o adapter por um falso com `music: true` e um
 * mapa de storage — sem IPC nem disco. A pasta não tem segredo nenhum, por isso
 * tudo vai para o storage normal, ao contrário do correio.
 */
const mocks = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  pickFilesRoot: vi.fn(),
  musicSetRoot: vi.fn(),
  musicReadDir: vi.fn(),
  toLocalMediaUrl: vi.fn(),
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    capabilities: { music: true },
    pickFilesRoot: mocks.pickFilesRoot,
    musicSetRoot: mocks.musicSetRoot,
    musicReadDir: mocks.musicReadDir,
    toLocalMediaUrl: mocks.toLocalMediaUrl,
    storageSet: vi.fn(async (key: string, value: unknown) => {
      mocks.storage.set(key, value);
    }),
    storageGet: vi.fn(async (key: string, fallback: unknown) =>
      mocks.storage.has(key) ? mocks.storage.get(key) : fallback,
    ),
    storageRemove: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
  }),
}));

beforeEach(() => {
  mocks.storage.clear();
  mocks.pickFilesRoot.mockReset();
  mocks.musicSetRoot.mockReset();
  mocks.musicReadDir.mockReset();
  mocks.toLocalMediaUrl.mockReset();

  mocks.pickFilesRoot.mockResolvedValue(null);
  mocks.musicSetRoot.mockResolvedValue({ path: 'C:/Musica', name: 'Musica' });
  mocks.musicReadDir.mockResolvedValue([]);
  mocks.toLocalMediaUrl.mockReturnValue('');

  useMusicSettingsStore.setState({ settings: DEFAULT_MUSIC_SETTINGS });
  musicService.setProvider(new MockMusicProvider());
});

describe('escolha do provedor', () => {
  it('por omissão fica no simulado — nada sai sem ser pedido', () => {
    applyMusicSettings(DEFAULT_MUSIC_SETTINGS);

    expect(musicService.providerName).toBe('Simulado');
  });

  it('com pasta passa à música local', () => {
    applyMusicSettings({ rootPath: 'C:/Musica', rootName: 'Musica' });

    expect(musicService.providerName).toBe('Música local');
  });

  it('sem pasta mantém o simulado — nunca rebenta por falta de configuração', () => {
    applyMusicSettings({ rootPath: '   ', rootName: '' });

    expect(musicService.providerName).toBe('Simulado');
  });
});

describe('a interface', () => {
  it('avisa que nada sai para a rede e que sem pasta fica o simulado', () => {
    render(<MusicSettings />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/nada sai para a rede/i);
    expect(note).toHaveTextContent(/simulada/i);
  });

  it('escolher pasta declara-a e mostra a pasta guardada', async () => {
    const user = userEvent.setup();
    mocks.pickFilesRoot.mockResolvedValue('C:/Musica');

    render(<MusicSettings />);

    await user.click(screen.getByRole('button', { name: /escolher pasta de música/i }));

    await waitFor(() => {
      expect(useMusicSettingsStore.getState().settings.rootPath).toBe('C:/Musica');
    });
    expect(mocks.musicSetRoot).toHaveBeenCalledWith('C:/Musica');
    expect(screen.getByRole('button', { name: /limpar a pasta de música/i })).toBeInTheDocument();
  });

  it('limpar a pasta volta ao simulado', async () => {
    const user = userEvent.setup();
    useMusicSettingsStore.setState({ settings: { rootPath: 'C:/Musica', rootName: 'Musica' } });

    render(<MusicSettings />);

    await user.click(screen.getByRole('button', { name: /limpar a pasta de música/i }));

    await waitFor(() => {
      expect(useMusicSettingsStore.getState().settings.rootPath).toBe('');
    });
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar e o provedor volta a ser ligado', async () => {
    useMusicSettingsStore.getState().setRoot('C:/Musica', 'Musica');
    await useMusicSettingsStore.getState().persist();

    useMusicSettingsStore.setState({ settings: DEFAULT_MUSIC_SETTINGS });
    await useMusicSettingsStore.getState().hydrate();
    applyMusicSettings(useMusicSettingsStore.getState().settings);

    expect(useMusicSettingsStore.getState().settings.rootPath).toBe('C:/Musica');
    expect(useMusicSettingsStore.getState().settings.rootName).toBe('Musica');
    expect(musicService.providerName).toBe('Música local');
  });

  it('sem nada gravado, arranca no simulado', async () => {
    await useMusicSettingsStore.getState().hydrate();
    applyMusicSettings(useMusicSettingsStore.getState().settings);

    expect(useMusicSettingsStore.getState().settings.rootPath).toBe('');
    expect(musicService.providerName).toBe('Simulado');
  });
});
