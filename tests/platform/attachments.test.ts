import { beforeEach, describe, expect, it, vi } from 'vitest';

import { attachmentsFromFileList, formatBytes, pickAttachmentsNative } from '@/platform/attachments';

/**
 * `pickAttachmentsNative` importa `@tauri-apps/plugin-dialog`/`plugin-fs`
 * dinamicamente; em jsdom estes módulos não existem, por isso são simulados
 * aqui. Os `vi.hoisted` dão acesso às funções simuladas nos testes.
 */
const dialogMock = vi.hoisted(() => ({ open: vi.fn() }));
const fsMock = vi.hoisted(() => ({ stat: vi.fn(), readFile: vi.fn() }));

vi.mock('@tauri-apps/plugin-dialog', () => dialogMock);
vi.mock('@tauri-apps/plugin-fs', () => fsMock);

/**
 * Uma `FileList` mínima para teste — o jsdom não implementa `DataTransfer`,
 * por isso não há forma de construir uma a sério fora do browser.
 */
function fileListOf(...files: readonly File[]): FileList {
  const list = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  };
  files.forEach((file, index) => {
    (list as Record<number, File>)[index] = file;
  });
  return list as unknown as FileList;
}

describe('formatBytes', () => {
  it('bytes simples, sem casas decimais', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('KB com uma casa decimal', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('MB com uma casa decimal', () => {
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('attachmentsFromFileList', () => {
  it('lê nome e tamanho de cada ficheiro', () => {
    const file = new File(['conteudo'], 'nota.txt', { type: 'text/plain' });

    const [attachment] = attachmentsFromFileList(fileListOf(file));

    expect(attachment?.name).toBe('nota.txt');
    expect(attachment?.sizeBytes).toBe(file.size);
  });

  it('gera pré-visualização só para imagens', () => {
    const image = new File(['fake-png-bytes'], 'foto.png', { type: 'image/png' });
    const doc = new File(['pdf'], 'contrato.pdf', { type: 'application/pdf' });

    const [previewed, notPreviewed] = attachmentsFromFileList(fileListOf(image, doc));

    expect(previewed?.previewUrl).not.toBeNull();
    expect(notPreviewed?.previewUrl).toBeNull();
  });
});

describe('pickAttachmentsNative', () => {
  beforeEach(() => {
    dialogMock.open.mockReset();
    fsMock.stat.mockReset();
    fsMock.readFile.mockReset();
  });

  it('não lê os bytes de uma imagem acima do limite (5 MB)', async () => {
    dialogMock.open.mockResolvedValueOnce(['/fotos/panorama.png']);
    fsMock.stat.mockResolvedValueOnce({ size: 200 * 1024 * 1024 });

    const [attachment] = (await pickAttachmentsNative()) ?? [];

    expect(fsMock.readFile).not.toHaveBeenCalled();
    expect(attachment?.previewUrl).toBeNull();
  });

  it('gera pré-visualização para uma imagem dentro do limite', async () => {
    dialogMock.open.mockResolvedValueOnce(['/fotos/pequena.jpg']);
    fsMock.stat.mockResolvedValueOnce({ size: 2 * 1024 * 1024 });
    fsMock.readFile.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    const [attachment] = (await pickAttachmentsNative()) ?? [];

    expect(fsMock.readFile).toHaveBeenCalledWith('/fotos/pequena.jpg');
    expect(attachment?.previewUrl).not.toBeNull();
  });

  it('deixa ficheiros não-imagem sem pré-visualização', async () => {
    dialogMock.open.mockResolvedValueOnce(['/docs/contrato.pdf']);
    fsMock.stat.mockResolvedValueOnce({ size: 1024 });

    const [attachment] = (await pickAttachmentsNative()) ?? [];

    expect(fsMock.readFile).not.toHaveBeenCalled();
    expect(attachment?.previewUrl).toBeNull();
  });
});
