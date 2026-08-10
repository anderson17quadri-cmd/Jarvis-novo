/**
 * Anexos: escolher ficheiros, com nome/tamanho e pré-visualização para
 * imagens — nativo primeiro, queda para `<input type="file">` no browser.
 *
 * Mesmo padrão de `native-dialogs.ts` (importação dinâmica com try/catch,
 * para não partir o build fora do Tauri).
 */

export interface DraftAttachment {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  /** Object URL, só para imagens. `null` para os outros tipos. */
  readonly previewUrl: string | null;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Tenta o diálogo nativo. `null` se não estiver disponível (sem Tauri) ou se cancelado. */
export async function pickAttachmentsNative(): Promise<readonly DraftAttachment[] | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { stat, readFile } = await import('@tauri-apps/plugin-fs');

    const selected = await open({ multiple: true });
    if (!selected) return null;

    const paths = Array.isArray(selected) ? selected : [selected];
    const attachments: DraftAttachment[] = [];

    for (const path of paths) {
      const name = path.split(/[/\\]/).pop() ?? path;
      const info = await stat(path);

      let previewUrl: string | null = null;
      if (IMAGE_EXTENSIONS.has(extensionOf(name))) {
        try {
          const bytes = await readFile(path);
          previewUrl = URL.createObjectURL(new Blob([bytes]));
        } catch {
          // Sem permissão para ler os bytes fora do scope do fs — o anexo
          // continua válido, só sem miniatura.
        }
      }

      attachments.push({
        id: `${path}-${info.size}-${Date.now()}`,
        name,
        sizeBytes: info.size,
        previewUrl,
      });
    }

    return attachments;
  } catch {
    return null;
  }
}

/** Converte `File`s do `<input type="file">` do browser para o mesmo formato. */
export function attachmentsFromFileList(files: FileList): readonly DraftAttachment[] {
  return Array.from(files).map((file) => ({
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    sizeBytes: file.size,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }));
}

/** Formata bytes em português, com a unidade certa (B, KB, MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
