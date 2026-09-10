/**
 * Lista de anexos reutilizável — Emails, Tarefas, Projetos.
 *
 * Mostra os anexos que já existem (nome, tamanho, tipo) e um botão para
 * acrescentar mais. A leitura do ficheiro é delegada a quem chama via
 * `onAttach` — assim cada janela decide se usa o diálogo nativo ou o
 * `<input type="file">` do browser.
 *
 * Modo só de leitura: quando `onAttach` não é passado, o botão de adicionar
 * não aparece. Quando `onRemove` não é passado, os botões de remover também
 * não — útil para emails recebidos ou projetos concluídos.
 */

import { useRef, useState } from 'react';
import { FileImage, FileText, File, Music, Video, Plus, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatAttachmentSize, type Attachment, type AttachmentKind } from '@/types/attachment';

const KIND_ICON: Record<AttachmentKind, React.ComponentType<{ className?: string }>> = {
  imagem: FileImage,
  pdf: FileText,
  audio: Music,
  video: Video,
  outro: File,
};

interface AttachmentListProps {
  readonly attachments: readonly Attachment[];
  /** Chamado quando o utilizador escolhe um ficheiro. Se omitido, o botão de
   *  adicionar não aparece (modo só de leitura). */
  readonly onAttach?: ((file: File) => void) | undefined;
  /** Chamado quando o utilizador remove um anexo. Se omitido, o botão de
   *  remover não aparece. */
  readonly onRemove?: ((attachmentId: string) => void) | undefined;
  /** Texto do botão de adicionar. "Anexar ficheiro" por omissão. */
  readonly addLabel?: string;
}

export function AttachmentList({
  attachments,
  onAttach,
  onRemove,
  addLabel = 'Anexar ficheiro',
}: AttachmentListProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (attachments.length === 0 && !onAttach) {
    // Só de leitura sem anexos — não mostra nada.
    return <></>;
  }

  return (
    <div className="space-y-1.5">
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((att) => {
            const Icon = KIND_ICON[att.kind];
            const isPreviewOpen = previewId === att.id;

            return (
              <li key={att.id}>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-2.5 py-1.5',
                    'text-[11.5px]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0 text-t3" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={() => setPreviewId(isPreviewOpen ? null : att.id)}
                    className="min-w-0 flex-1 truncate text-left text-t2 transition-colors hover:text-accent"
                  >
                    {att.name}
                  </button>

                  <span className="mono flex-shrink-0 text-[10.5px] text-t3">
                    {formatAttachmentSize(att.sizeBytes)}
                  </span>

                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(att.id)}
                      aria-label={`Remover ${att.name}`}
                      className="flex-shrink-0 rounded p-0.5 text-t3 transition-colors hover:text-danger"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {isPreviewOpen && att.kind === 'imagem' && att.dataUri !== null && (
                  <div className="mt-1 overflow-hidden rounded-input border border-line">
                    <img
                      src={att.dataUri}
                      alt={att.name}
                      className="max-h-[200px] w-full object-contain"
                    />
                  </div>
                )}

                {isPreviewOpen && att.kind !== 'imagem' && (
                  <p className="mt-1 px-2.5 text-[11px] text-t3">
                    Pré-visualização disponível só para imagens.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {onAttach && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex items-center gap-1.5 rounded-input border border-line px-2.5 py-1.5',
              'text-[11.5px] text-t3 transition-all duration-hover',
              'hover:border-accent/35 hover:text-accent',
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {addLabel}
          </button>

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            aria-label={addLabel}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAttach(file);
              // Limpa para o mesmo ficheiro poder ser escolhido outra vez.
              event.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}
