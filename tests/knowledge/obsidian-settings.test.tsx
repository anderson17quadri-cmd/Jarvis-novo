import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ObsidianSettings } from '@/apps/personalization/ObsidianSettings';
import { applyObsidianSettings } from '@/hooks/use-obsidian-settings';
import { obsidianService } from '@/services/knowledge/obsidian-service';
import { useObsidianSettingsStore } from '@/stores/use-obsidian-settings-store';
import { DEFAULT_OBSIDIAN_SETTINGS } from '@/types/obsidian-settings';

/**
 * O vault Obsidian fala com o Rust por `obsidianSetRoot`/`obsidianListNotes`/
 * `obsidianReadNote`/`obsidianWriteNote`, expostos no adapter. Mesmo padrão
 * dos testes da Música: adapter falso, `capabilities.obsidian: true`, sem
 * IPC nem disco.
 */
const mocks = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  pickFilesRoot: vi.fn(),
  obsidianSetRoot: vi.fn(),
  obsidianListNotes: vi.fn(),
  obsidianReadNote: vi.fn(),
  obsidianWriteNote: vi.fn(),
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    capabilities: { obsidian: true },
    pickFilesRoot: mocks.pickFilesRoot,
    obsidianSetRoot: mocks.obsidianSetRoot,
    obsidianListNotes: mocks.obsidianListNotes,
    obsidianReadNote: mocks.obsidianReadNote,
    obsidianWriteNote: mocks.obsidianWriteNote,
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
  mocks.obsidianSetRoot.mockReset();
  mocks.obsidianListNotes.mockReset();
  mocks.obsidianReadNote.mockReset();
  mocks.obsidianWriteNote.mockReset();

  mocks.pickFilesRoot.mockResolvedValue(null);
  mocks.obsidianSetRoot.mockResolvedValue({ path: 'C:/Vault', name: 'Vault' });
  mocks.obsidianListNotes.mockResolvedValue([]);
  mocks.obsidianReadNote.mockResolvedValue(null);
  mocks.obsidianWriteNote.mockResolvedValue(true);

  useObsidianSettingsStore.setState({ settings: DEFAULT_OBSIDIAN_SETTINGS });
});

describe('a interface', () => {
  it('avisa o que muda quando há uma pasta escolhida', () => {
    render(<ObsidianSettings />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/nada sai para a rede/i);
    expect(note).toHaveTextContent(/procurar, ler e/i);
  });

  it('escolher vault declara-o e mostra a pasta guardada', async () => {
    const user = userEvent.setup();
    mocks.pickFilesRoot.mockResolvedValue('C:/Vault');

    render(<ObsidianSettings />);

    await user.click(screen.getByRole('button', { name: /escolher vault obsidian/i }));

    await waitFor(() => {
      expect(useObsidianSettingsStore.getState().settings.rootPath).toBe('C:/Vault');
    });
    expect(mocks.obsidianSetRoot).toHaveBeenCalledWith('C:/Vault');
    expect(screen.getByRole('button', { name: /limpar o vault obsidian/i })).toBeInTheDocument();
  });

  it('escolher vault relê a lista de notas logo a seguir', async () => {
    const user = userEvent.setup();
    mocks.pickFilesRoot.mockResolvedValue('C:/Vault');
    mocks.obsidianListNotes.mockResolvedValue([{ path: 'a.md', title: 'a', modifiedAt: 1 }]);

    render(<ObsidianSettings />);
    await user.click(screen.getByRole('button', { name: /escolher vault obsidian/i }));

    await waitFor(() => {
      expect(obsidianService.cachedNotes).toHaveLength(1);
    });
  });

  it('uma pasta que falha a declarar mostra o erro, sem guardar nada', async () => {
    const user = userEvent.setup();
    mocks.pickFilesRoot.mockResolvedValue('C:/Vault');
    mocks.obsidianSetRoot.mockResolvedValue(null);

    render(<ObsidianSettings />);
    await user.click(screen.getByRole('button', { name: /escolher vault obsidian/i }));

    expect(await screen.findByText('Não consegui usar essa pasta.')).toBeInTheDocument();
    expect(useObsidianSettingsStore.getState().settings.rootPath).toBe('');
  });

  it('limpar o vault volta ao não configurado', async () => {
    const user = userEvent.setup();
    useObsidianSettingsStore.setState({ settings: { rootPath: 'C:/Vault', rootName: 'Vault' } });

    render(<ObsidianSettings />);
    await user.click(screen.getByRole('button', { name: /limpar o vault obsidian/i }));

    await waitFor(() => {
      expect(useObsidianSettingsStore.getState().settings.rootPath).toBe('');
    });
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar', async () => {
    useObsidianSettingsStore.getState().setRoot('C:/Vault', 'Vault');
    await useObsidianSettingsStore.getState().persist();

    useObsidianSettingsStore.setState({ settings: DEFAULT_OBSIDIAN_SETTINGS });
    await useObsidianSettingsStore.getState().hydrate();

    expect(useObsidianSettingsStore.getState().settings.rootPath).toBe('C:/Vault');
    expect(useObsidianSettingsStore.getState().settings.rootName).toBe('Vault');
  });

  it('sem nada gravado, arranca vazio', async () => {
    await useObsidianSettingsStore.getState().hydrate();
    expect(useObsidianSettingsStore.getState().settings.rootPath).toBe('');
  });
});

describe('applyObsidianSettings — liga a escolha ao serviço', () => {
  it('com pasta, relê as notas', () => {
    mocks.obsidianListNotes.mockResolvedValue([{ path: 'a.md', title: 'a', modifiedAt: 1 }]);
    applyObsidianSettings({ rootPath: 'C:/Vault', rootName: 'Vault' });

    return waitFor(() => expect(mocks.obsidianListNotes).toHaveBeenCalled());
  });

  it('sem pasta, nunca chama o adapter', () => {
    applyObsidianSettings(DEFAULT_OBSIDIAN_SETTINGS);
    expect(mocks.obsidianListNotes).not.toHaveBeenCalled();
  });
});
