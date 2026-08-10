import { describe, expect, it } from 'vitest';

import { attachmentsFromFileList, formatBytes } from '@/platform/attachments';

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
