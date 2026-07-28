import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import FilesWindow from '@/apps/files/FilesWindow';
import { seedFiles } from '@/data/files';
import { resolvePath } from '@/types/file-entry';

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
