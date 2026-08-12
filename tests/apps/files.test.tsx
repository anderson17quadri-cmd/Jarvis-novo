import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import FilesWindow from '@/apps/files/FilesWindow';
import { seedFiles } from '@/data/files';
import { usePendingFileNavigationStore } from '@/stores/use-pending-file-navigation-store';
import { resolvePath, searchFiles } from '@/types/file-entry';
import { normalizeSearch } from '@/utils/text';

describe('explorador de ficheiros', () => {
  it('abre na raiz', () => {
    render(<FilesWindow />);

    expect(screen.getByRole('button', { name: /^Documentos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Projetos/ })).toBeInTheDocument();
  });

  it('entrar numa pasta mostra o que lá está', async () => {
    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.click(screen.getByRole('button', { name: /^Documentos/ }));

    expect(screen.getByRole('button', { name: /^Propostas/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Media/ })).toBeNull();
  });

  it('as migalhas levam de volta', async () => {
    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.click(screen.getByRole('button', { name: /^Documentos/ }));
    await user.click(screen.getByRole('button', { name: /^Propostas/ }));
    expect(screen.getByText('proposta-barbearia-silva.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Início' }));
    expect(screen.getByRole('button', { name: /^Media/ })).toBeInTheDocument();
  });

  it('um ficheiro não abre — não há nada para o abrir', () => {
    render(<FilesWindow />);

    expect(screen.getByRole('button', { name: /copia-seguranca-2026\.zip/ })).toBeDisabled();
  });

  it('as pastas ficam à frente dos ficheiros, seja qual for a ordenação', async () => {
    const user = userEvent.setup();
    render(<FilesWindow />);

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'tamanho');

    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    const firstFile = names.findIndex((name) => name.includes('copia-seguranca'));
    const lastFolder = names.findLastIndex((name) => name.includes('Media'));

    expect(lastFolder).toBeLessThan(firstFile);
  });

  it('diz que a árvore é simulada', () => {
    render(<FilesWindow />);
    expect(screen.getByText(/nada aqui toca no disco/i)).toBeInTheDocument();
  });
});

describe('resolvePath', () => {
  const root = seedFiles();

  it('desce até ao nível pedido', () => {
    const level = resolvePath(root, ['documentos', 'propostas']);
    expect(level.map((entry) => entry.id)).toContain('proposta-barbearia');
  });

  it('um caminho inválido devolve o último nível válido, em vez de rebentar', () => {
    const level = resolvePath(root, ['documentos', 'nao-existe']);
    expect(level.map((entry) => entry.id)).toContain('propostas');
  });

  it('parar num ficheiro não tenta descer para dentro dele', () => {
    const level = resolvePath(root, ['copia-seguranca']);
    expect(level.map((entry) => entry.id)).toContain('documentos');
  });
});

describe('searchFiles', () => {
  const root = seedFiles();

  it('encontra por nome parcial, sem acentos', () => {
    const results = searchFiles(root, 'orcamento', normalizeSearch);
    expect(results.map((result) => result.entry.id)).toContain('orcamento-hardware');
  });

  it('o caminho são as pastas antecessoras, nunca o próprio resultado', () => {
    const [result] = searchFiles(root, 'orcamento-hardware-revisto', normalizeSearch);
    expect(result?.path).toEqual(['documentos', 'propostas']);
    expect(result?.pathNames).toEqual(['Documentos', 'Propostas']);
  });

  it('uma pasta encontrada aponta para a pasta que a contém, não para si própria', () => {
    const [result] = searchFiles(root, 'propostas', normalizeSearch);
    expect(result?.entry.id).toBe('propostas');
    expect(result?.path).toEqual(['documentos']);
  });

  it('sem correspondência, devolve uma lista vazia', () => {
    expect(searchFiles(root, 'inexistente', normalizeSearch)).toEqual([]);
  });

  it('consulta vazia não devolve tudo', () => {
    expect(searchFiles(root, '', normalizeSearch)).toEqual([]);
  });
});

describe('explorador — caminho pendente do assistente', () => {
  beforeEach(() => {
    usePendingFileNavigationStore.setState({ path: null });
  });

  it('abrir_ficheiro deixa a janela já na pasta certa', () => {
    usePendingFileNavigationStore.getState().set(['documentos', 'propostas']);
    render(<FilesWindow />);

    expect(screen.getByText('proposta-barbearia-silva.pdf')).toBeInTheDocument();
  });

  it('o caminho pendente só serve para a primeira leitura', () => {
    usePendingFileNavigationStore.getState().set(['documentos']);
    render(<FilesWindow />);

    expect(usePendingFileNavigationStore.getState().path).toBeNull();
  });
});
