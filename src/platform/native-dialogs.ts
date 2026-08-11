/**
 * Diálogos nativos de ficheiro, com queda para o browser.
 *
 * O plugin `dialog` do Tauri está registado (Cargo.toml, lib.rs), e o plugin
 * `fs` também — mas a interface ainda não os chamava. Este módulo expõe duas
 * funções que tentam o diálogo nativo primeiro e, se falhar (a correr no
 * browser, sem Tauri), caem para os mecanismos do browser.
 *
 * A importação dinâmica com try/catch é de propósito: em contexto de browser
 * puro, os módulos `@tauri-apps/*` não existem e um `import` estático
 * partiria o build.
 */

/**
 * Abre o diálogo nativo de gravação e escreve o conteúdo.
 *
 * Devolve `true` se o ficheiro foi escrito, `false` se o utilizador cancelou
 * ou se o diálogo nativo não está disponível (nesse caso, quem chama cai para
 * o `<a download>` do browser).
 */
export async function saveWithNativeDialog(
  defaultName: string,
  content: string,
): Promise<boolean> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!filePath) return false;
    await writeTextFile(filePath, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Abre o diálogo nativo de abertura e devolve o conteúdo do ficheiro.
 *
 * Devolve o texto lido, ou `null` se o utilizador cancelou ou se o diálogo
 * nativo não está disponível (nesse caso, quem chama cai para o
 * `<input type="file">` do browser).
 */
export async function openWithNativeDialog(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    const selected = await open({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
    });

    if (!selected || typeof selected !== 'string') return null;
    return await readTextFile(selected);
  } catch {
    return null;
  }
}

/**
 * Abre o diálogo nativo de ficheiro para anexos (qualquer tipo).
 *
 * Devolve `{ path, name, size }` ou `null` se cancelado. O caminho é o caminho
 * absoluto do ficheiro no sistema de ficheiros — o conteúdo é lido depois com
 * `readFile` do plugin `fs`.
 */
export async function openAttachmentDialog(): Promise<{
  path: string;
  name: string;
  size: number;
} | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { stat } = await import('@tauri-apps/plugin-fs');

    const selected = await open({
      filters: [
        {
          name: 'Todos os ficheiros',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'pdf', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'mp4', 'webm', 'avi', 'mov', 'mkv', 'txt', 'csv', 'json', 'xml', 'zip'],
        },
      ],
      multiple: false,
    });

    if (!selected || typeof selected !== 'string') return null;

    const fileStat = await stat(selected);
    const name = selected.split(/[/\\]/).pop() ?? 'ficheiro';

    return { path: selected, name, size: fileStat.size };
  } catch {
    return null;
  }
}

/**
 * Lê um ficheiro como data URI (base64) para pré-visualização no browser.
 *
 * Devolve `null` se falhar (ex.: ficheiro maior do que o limite).
 */
export async function readFileAsDataUri(filePath: string): Promise<string | null> {
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'bin';
    const mime = MIME_MAP[ext] ?? 'application/octet-stream';
    // Converter Uint8Array para base64
    const binary = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join('');
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Mapa de extensão → MIME type para data URIs. */
const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  opus: 'audio/opus',
  mp4: 'video/mp4',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
};
