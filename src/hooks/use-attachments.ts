/**
 * Hook para gerir anexos — partilhado entre Emails, Tarefas e Projetos.
 *
 * Lê um `File` do browser (via `<input type="file">` ou drop) e converte-o
 * num `Attachment`. No Tauri, tenta o diálogo nativo primeiro.
 */

import { useCallback, useState } from 'react';

import { openAttachmentDialog, readFileAsDataUri } from '@/platform/native-dialogs';
import { attachmentKind, type Attachment } from '@/types/attachment';

let nextId = 1;
function createId(): string {
  return `att_${nextId++}_${Date.now().toString(36)}`;
}

/**
 * Lê um `File` do browser e devolve um `Attachment`. Imagens até 5 MB são lidas
 * como data URI para pré-visualização; ficheiros maiores ou não-imagem ficam com
 * `dataUri: null`.
 */
async function readBrowserFile(file: File): Promise<Attachment> {
  const kind = attachmentKind(file.name);
  let dataUri: string | null = null;

  if (kind === 'imagem' && file.size <= 5 * 1024 * 1024) {
    dataUri = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  return {
    id: createId(),
    name: file.name,
    sizeBytes: file.size,
    kind,
    dataUri,
  };
}

export interface UseAttachments {
  readonly attachments: readonly Attachment[];
  readonly isNativeAvailable: boolean;
  /** Adiciona um anexo via `<input type="file">` do browser. */
  readonly attachBrowserFile: (file: File) => void;
  /** Remove um anexo pelo ID. */
  readonly removeAttachment: (id: string) => void;
  /** Substitui a lista inteira. */
  readonly setAttachments: (attachments: readonly Attachment[]) => void;
}

export function useAttachments(initial: readonly Attachment[] = []): UseAttachments {
  const [attachments, setAttachments] = useState<readonly Attachment[]>(initial);
  const [isNativeAvailable] = useState<boolean>(() => {
    // Detecta se estamos dentro do Tauri — se sim, o diálogo nativo está disponível.
    try {
      return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
    } catch {
      return false;
    }
  });

  const attachBrowserFile = useCallback((file: File) => {
    void readBrowserFile(file).then((att) => {
      setAttachments((prev) => [...prev, att]);
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  }, []);

  return { attachments, isNativeAvailable, attachBrowserFile, removeAttachment, setAttachments };
}

/**
 * Tenta abrir o diálogo nativo do Tauri para selecionar um ficheiro e
 * devolve um `Attachment`. Devolve `null` se cancelado ou indisponível.
 *
 * Usa `openAttachmentDialog` + `readFileAsDataUri` da plataforma nativa.
 * Para usar no browser, chama `attachBrowserFile` com o `<input type="file">`.
 */
export async function attachViaNativeDialog(): Promise<Attachment | null> {
  const result = await openAttachmentDialog();
  if (!result) return null;

  const kind = attachmentKind(result.name);
  let dataUri: string | null = null;

  if (kind === 'imagem' && result.size <= 5 * 1024 * 1024) {
    dataUri = await readFileAsDataUri(result.path);
  }

  return {
    id: createId(),
    name: result.name,
    sizeBytes: result.size,
    kind,
    dataUri,
  };
}
