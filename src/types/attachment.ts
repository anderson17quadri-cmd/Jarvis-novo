/** Anexo partilhado entre Emails, Tarefas e Projetos. */

export type AttachmentKind = 'imagem' | 'pdf' | 'audio' | 'video' | 'outro';

/** Derivado da extensão do ficheiro. */
export function attachmentKind(name: string): AttachmentKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'imagem';
  if (ext === 'pdf') return 'pdf';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) return 'video';
  return 'outro';
}

export interface Attachment {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly kind: AttachmentKind;
  /**
   * Conteúdo como data URI (`data:…;base64,…`) para pré-visualização.
   * `null` se o ficheiro ainda não foi lido ou se é demasiado grande.
   */
  readonly dataUri: string | null;
}

/** Formata bytes para apresentação: "1.2 MB", "340 kB", "12 B". */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} kB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/** Extensões que o diálogo nativo de ficheiro mostra. */
export const ATTACHMENT_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp',
  'pdf',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus',
  'mp4', 'webm', 'avi', 'mov', 'mkv',
];
