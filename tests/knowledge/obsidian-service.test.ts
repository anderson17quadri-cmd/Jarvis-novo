import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  obsidianListNotes: vi.fn(),
  obsidianReadNote: vi.fn(),
  obsidianWriteNote: vi.fn(),
}));

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({
    obsidianListNotes: mocks.obsidianListNotes,
    obsidianReadNote: mocks.obsidianReadNote,
    obsidianWriteNote: mocks.obsidianWriteNote,
  }),
}));

import { obsidianService } from '@/services/knowledge/obsidian-service';

const NOTES = [
  { path: 'Receitas/Bolo de chocolate.md', title: 'Bolo de chocolate', modifiedAt: 1 },
  { path: 'Trabalho/Reunião de equipa.md', title: 'Reunião de equipa', modifiedAt: 2 },
  { path: 'Notas soltas.md', title: 'Notas soltas', modifiedAt: 3 },
];

beforeEach(() => {
  mocks.obsidianListNotes.mockReset();
  mocks.obsidianReadNote.mockReset();
  mocks.obsidianWriteNote.mockReset();

  mocks.obsidianListNotes.mockResolvedValue(NOTES);
  mocks.obsidianReadNote.mockResolvedValue(null);
  mocks.obsidianWriteNote.mockResolvedValue(true);
});

describe('refreshNotes / cachedNotes', () => {
  it('sem relê nunca, a lista fica vazia', () => {
    expect(obsidianService.cachedNotes).toEqual([]);
  });

  it('depois de relida, fica em cache', async () => {
    await obsidianService.refreshNotes();
    expect(obsidianService.cachedNotes).toEqual(NOTES);
  });
});

describe('searchByTitle', () => {
  beforeEach(async () => {
    await obsidianService.refreshNotes();
  });

  it('procura sem acentos e parcial', () => {
    const results = obsidianService.searchByTitle('reuniao');
    expect(results.map((n) => n.title)).toEqual(['Reunião de equipa']);
  });

  it('várias notas podem bater com a mesma procura', () => {
    const results = obsidianService.searchByTitle('o');
    expect(results.length).toBeGreaterThan(1);
  });

  it('sem correspondência, lista vazia', () => {
    expect(obsidianService.searchByTitle('inexistente')).toEqual([]);
  });

  it('procura vazia não devolve tudo — devolve nada', () => {
    expect(obsidianService.searchByTitle('')).toEqual([]);
    expect(obsidianService.searchByTitle('   ')).toEqual([]);
  });
});

describe('readByTitle', () => {
  beforeEach(async () => {
    await obsidianService.refreshNotes();
  });

  it('lê o conteúdo da primeira nota que bate com o título', async () => {
    mocks.obsidianReadNote.mockResolvedValue('# Bolo\n\n200g de chocolate.');

    const content = await obsidianService.readByTitle('bolo');

    expect(mocks.obsidianReadNote).toHaveBeenCalledWith('Receitas/Bolo de chocolate.md');
    expect(content).toBe('# Bolo\n\n200g de chocolate.');
  });

  it('sem nota correspondente, null sem chamar o adapter', async () => {
    const content = await obsidianService.readByTitle('inexistente');

    expect(content).toBeNull();
    expect(mocks.obsidianReadNote).not.toHaveBeenCalled();
  });
});

describe('write', () => {
  it('sanitiza o título antes de o usar como nome de ficheiro', async () => {
    await obsidianService.write('Ideias: 2026/08?', 'conteúdo');

    expect(mocks.obsidianWriteNote).toHaveBeenCalledWith('Ideias- 2026-08-.md', 'conteúdo');
  });

  it('título vazio (ou só espaços) recusa sem chamar o adapter', async () => {
    const ok = await obsidianService.write('   ', 'conteúdo');

    expect(ok).toBe(false);
    expect(mocks.obsidianWriteNote).not.toHaveBeenCalled();
  });

  it('depois de escrever com sucesso, relê a lista — a nota nova aparece na cache', async () => {
    mocks.obsidianWriteNote.mockResolvedValue(true);
    mocks.obsidianListNotes.mockResolvedValue([
      ...NOTES,
      { path: 'Ideia nova.md', title: 'Ideia nova', modifiedAt: 4 },
    ]);

    const ok = await obsidianService.write('Ideia nova', 'texto');

    expect(ok).toBe(true);
    expect(obsidianService.cachedNotes.some((n) => n.title === 'Ideia nova')).toBe(true);
  });

  it('se a escrita falhar, não tenta relê a lista à toa', async () => {
    mocks.obsidianWriteNote.mockResolvedValue(false);
    mocks.obsidianListNotes.mockClear();

    const ok = await obsidianService.write('Falha', 'texto');

    expect(ok).toBe(false);
    expect(mocks.obsidianListNotes).not.toHaveBeenCalled();
  });
});
