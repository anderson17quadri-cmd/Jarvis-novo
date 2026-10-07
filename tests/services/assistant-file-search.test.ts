import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchAssistantFiles } from '@/services/assistant/file-search';
import { getPlatformAdapter } from '@/platform';

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe('pesquisa de ficheiros do assistente', () => {
  it('não devolve resultados de uma raiz trocada durante a pesquisa', async () => {
    const adapter = getPlatformAdapter();
    vi.spyOn(adapter, 'capabilities', 'get').mockReturnValue({ ...adapter.capabilities, realFilesystem: true });
    vi.spyOn(adapter, 'storageGet').mockResolvedValueOnce('C:/A').mockResolvedValue('C:/B');
    vi.spyOn(adapter, 'filesSetRoot').mockResolvedValue({ path: 'C:/A', name: 'A' });
    vi.spyOn(adapter, 'filesReadDir').mockResolvedValue([{ name: 'nota.txt', path: 'C:/A/nota.txt', isDirectory: false, sizeBytes: 1, modifiedAt: 0 }]);
    expect(await searchAssistantFiles('nota')).toMatchObject({ source: 'indisponível', matches: [] });
  });

  it('uma subpasta ilegível torna a pesquisa explicitamente parcial', async () => {
    const adapter = getPlatformAdapter();
    vi.spyOn(adapter, 'capabilities', 'get').mockReturnValue({ ...adapter.capabilities, realFilesystem: true });
    vi.spyOn(adapter, 'storageGet').mockResolvedValue('C:/A');
    vi.spyOn(adapter, 'filesSetRoot').mockResolvedValue({ path: 'C:/A', name: 'A' });
    vi.spyOn(adapter, 'filesReadDir').mockResolvedValue(null);
    expect(await searchAssistantFiles('nota')).toMatchObject({ source: 'real', matches: [], isTruncated: true });
  });
  it('pesquisa a raiz escolhida e conserva o caminho real da pasta', async () => {
    const adapter = getPlatformAdapter();
    vi.spyOn(adapter, 'capabilities', 'get').mockReturnValue({ ...adapter.capabilities, realFilesystem: true });
    vi.spyOn(adapter, 'storageGet').mockResolvedValue('C:/Documentos');
    vi.spyOn(adapter, 'filesSetRoot').mockResolvedValue({ path: 'C:/Documentos', name: 'Documentos' });
    vi.spyOn(adapter, 'filesReadDir').mockImplementation(async path => path === 'C:/Documentos' ? [{
      name: 'Trabalho', path: 'C:/Documentos/Trabalho', isDirectory: true, modifiedAt: 0, sizeBytes: null,
    }] : [{ name: 'Orçamento.pdf', path: 'C:/Documentos/Trabalho/Orçamento.pdf', isDirectory: false, modifiedAt: 0, sizeBytes: 4 }]);
    const result = await searchAssistantFiles('orcamento');
    expect(result.source).toBe('real');
    expect(result.matches[0]).toMatchObject({ name: 'Orçamento.pdf', pathNames: ['Documentos', 'Trabalho'],
      realParents: [{ path: 'C:/Documentos', name: 'Documentos' }, { path: 'C:/Documentos/Trabalho', name: 'Trabalho' }] });
  });
  it('uma raiz ilegível não apresenta exemplos como resultados reais', async () => {
    const adapter = getPlatformAdapter();
    vi.spyOn(adapter, 'capabilities', 'get').mockReturnValue({ ...adapter.capabilities, realFilesystem: true });
    vi.spyOn(adapter, 'storageGet').mockResolvedValue('C:/Documentos');
    vi.spyOn(adapter, 'filesSetRoot').mockResolvedValue(null);
    const result = await searchAssistantFiles('orçamento');
    expect(result.source).toBe('indisponível');
    expect(result.matches).toEqual([]);
  });
});
