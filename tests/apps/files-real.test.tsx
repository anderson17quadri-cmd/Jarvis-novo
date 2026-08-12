import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RealFileEntry, RealFilesRoot } from '@/types/real-file-entry';

/**
 * FilesWindow em modo real — mocka `@/platform` inteiro, por isso vive num
 * ficheiro à parte de `files.test.tsx` (esse cobre o modo simulado, contra o
 * `WebAdapter` a sério, sem sistema de ficheiros real).
 */

const storage = new Map<string, unknown>();

let pickFilesRoot: () => Promise<string | null> = vi.fn(async () => null);
let filesSetRoot: (path: string) => Promise<RealFilesRoot | null> = vi.fn(async () => null);
let filesReadDir: (path: string | null) => Promise<readonly RealFileEntry[] | null> = vi.fn(
  async () => null,
);

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    capabilities: { realFilesystem: true, fileDialogs: true },
    storageGet: vi.fn(async (key: string, fallback: unknown) => storage.get(key) ?? fallback),
    storageSet: vi.fn(async (key: string, value: unknown) => {
      storage.set(key, value);
    }),
    storageRemove: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    pickFilesRoot: () => pickFilesRoot(),
    filesSetRoot: (path: string) => filesSetRoot(path),
    filesReadDir: (path: string | null) => filesReadDir(path),
  }),
}));

import FilesWindow from '@/apps/files/FilesWindow';
import { usePendingFileNavigationStore } from '@/stores/use-pending-file-navigation-store';

const ROOT: RealFilesRoot = { path: 'C:/Utilizador/Documentos', name: 'Documentos' };

const ROOT_ENTRIES: readonly RealFileEntry[] = [
  { name: 'Fotos', path: 'C:/Utilizador/Documentos/Fotos', isDirectory: true, sizeBytes: null, modifiedAt: 1_700_000_000_000 },
  { name: 'notas.txt', path: 'C:/Utilizador/Documentos/notas.txt', isDirectory: false, sizeBytes: 512, modifiedAt: 1_700_000_000_000 },
];

describe('FilesWindow — modo real', () => {
  beforeEach(() => {
    storage.clear();
    usePendingFileNavigationStore.setState({ path: null });
    pickFilesRoot = vi.fn(async () => null);
    filesSetRoot = vi.fn(async () => null);
    filesReadDir = vi.fn(async () => null);
  });

  it('mostra o botão para escolher uma pasta real quando a plataforma suporta', () => {
    render(<FilesWindow />);
    expect(screen.getByRole('button', { name: /Escolher pasta real/ })).toBeInTheDocument();
  });

  it('escolher uma pasta lista o que lá está a sério', async () => {
    pickFilesRoot = vi.fn(async () => ROOT.path);
    filesSetRoot = vi.fn(async () => ROOT);
    filesReadDir = vi.fn(async () => ROOT_ENTRIES);

    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.click(screen.getByRole('button', { name: /Escolher pasta real/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Fotos/ })).toBeInTheDocument();
    });
    expect(screen.getByText('notas.txt')).toBeInTheDocument();
    expect(screen.getByText(/Pasta real:/)).toBeInTheDocument();
  });

  it('descer para uma pasta real pede o nível seguinte com o caminho novo', async () => {
    pickFilesRoot = vi.fn(async () => ROOT.path);
    filesSetRoot = vi.fn(async () => ROOT);
    filesReadDir = vi.fn(async (path: string | null) =>
      path === ROOT.path ? ROOT_ENTRIES : [],
    );

    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.click(screen.getByRole('button', { name: /Escolher pasta real/ }));
    await waitFor(() => screen.getByRole('button', { name: /^Fotos/ }));

    await user.click(screen.getByRole('button', { name: /^Fotos/ }));

    await waitFor(() => {
      expect(filesReadDir).toHaveBeenCalledWith('C:/Utilizador/Documentos/Fotos');
    });
  });

  it('um erro a ler a pasta mostra-se, mas não rebenta a janela', async () => {
    pickFilesRoot = vi.fn(async () => ROOT.path);
    filesSetRoot = vi.fn(async () => ROOT);
    filesReadDir = vi.fn(async () => null);

    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.click(screen.getByRole('button', { name: /Escolher pasta real/ }));

    await waitFor(() => {
      expect(screen.getByText(/Não consegui ler esta pasta/)).toBeInTheDocument();
    });
  });

  it('voltar à árvore simulada esquece a pasta guardada', async () => {
    pickFilesRoot = vi.fn(async () => ROOT.path);
    filesSetRoot = vi.fn(async () => ROOT);
    filesReadDir = vi.fn(async () => ROOT_ENTRIES);

    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.click(screen.getByRole('button', { name: /Escolher pasta real/ }));
    await waitFor(() => screen.getByRole('button', { name: /Árvore simulada/ }));

    await user.click(screen.getByRole('button', { name: /Árvore simulada/ }));

    expect(screen.getByRole('button', { name: /^Documentos/ })).toBeInTheDocument();
    expect(storage.has('files.real-root-path')).toBe(false);
  });

  it('reabre sozinha a última pasta real guardada, ao arrancar', async () => {
    storage.set('files.real-root-path', ROOT.path);
    filesSetRoot = vi.fn(async () => ROOT);
    filesReadDir = vi.fn(async () => ROOT_ENTRIES);

    render(<FilesWindow />);

    await waitFor(() => {
      expect(screen.getByText('notas.txt')).toBeInTheDocument();
    });
    expect(filesSetRoot).toHaveBeenCalledWith(ROOT.path);
  });

  it('uma raiz guardada que já não existe cai para o simulado, sem erro à vista', async () => {
    storage.set('files.real-root-path', ROOT.path);
    filesSetRoot = vi.fn(async () => null);

    render(<FilesWindow />);

    await waitFor(() => {
      expect(storage.has('files.real-root-path')).toBe(false);
    });
    expect(screen.getByRole('button', { name: /^Documentos/ })).toBeInTheDocument();
    expect(screen.queryByText(/Não consegui/)).toBeNull();
  });

  it('um caminho pendente do assistente tem prioridade sobre a raiz real guardada', async () => {
    storage.set('files.real-root-path', ROOT.path);
    usePendingFileNavigationStore.getState().set(['documentos', 'propostas']);

    render(<FilesWindow />);

    expect(screen.getByText('proposta-barbearia-silva.pdf')).toBeInTheDocument();
    expect(filesSetRoot).not.toHaveBeenCalled();
  });
});
