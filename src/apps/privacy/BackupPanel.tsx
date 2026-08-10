import { useRef, useState } from 'react';
import { Download, TriangleAlert, Upload } from 'lucide-react';

import { cn } from '@/lib/cn';
import { createBackup, restoreBackup, serializeBackup } from '@/services/backup-service';
import { notificationService } from '@/services/notification-service';
import { STORAGE_KEYS } from '@/services/storage-service';
import { BACKUP_PROBLEMS, backupFilename, readBackup, SECRET_FIELDS } from '@/types/backup';
import type { JarvisBackup } from '@/types/backup';
import { openWithNativeDialog, saveWithNativeDialog } from '@/platform/native-dialogs';

/**
 * Cópias de segurança (Parte 14 §Backups e restauro).
 *
 * Tudo o que o JARVIS sabe de si vive no armazenamento local do dispositivo.
 * Limpar os dados do browser — coisa que se faz por rotina, sem pensar no que
 * está lá dentro — apagava temas, layouts, conversas, memória, tarefas e
 * automações de uma vez. Isto é a saída.
 *
 * O restauro pede confirmação e diz o que vai substituir. Não é uma pergunta
 * de cortesia: repor uma cópia de fevereiro em cima do trabalho de agosto é
 * exatamente o tipo de engano que só se percebe depois.
 */
export function BackupPanel(): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<JarvisBackup | null>(null);
  const [isWorking, setWorking] = useState(false);

  const download = async (): Promise<void> => {
    setWorking(true);

    try {
      const backup = await createBackup();
      const serialized = serializeBackup(backup);
      const filename = backupFilename(new Date());

      // Tentar o diálogo nativo primeiro (plugin `dialog` do Tauri).
      // Se falhar — a correr no browser, por exemplo — cai para o
      // `<a download>` de sempre.
      const savedNatively = await saveWithNativeDialog(filename, serialized);

      if (savedNatively) {
        const sections = Object.keys(backup.data).length;
        notificationService.success(
          'Cópia guardada',
          `${filename} — ${sections} ${sections === 1 ? 'secção' : 'secções'}, sem a chave da API.`,
        );
        return;
      }

      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      const sections = Object.keys(backup.data).length;
      notificationService.success(
        'Cópia descarregada',
        `${link.download} — ${sections} ${sections === 1 ? 'secção' : 'secções'}, sem a chave da API.`,
      );
    } finally {
      setWorking(false);
    }
  };

  const importFromFile = async (): Promise<void> => {
    // Tentar o diálogo nativo primeiro.
    const nativeContent = await openWithNativeDialog();

    if (nativeContent !== null) {
      const result = readBackup(nativeContent);
      if (!result.ok) {
        notificationService.error('Não deu para ler', BACKUP_PROBLEMS[result.problem]);
        return;
      }
      setPending(result.backup);
      return;
    }

    // Cair para o `<input type="file">` do browser.
    fileRef.current?.click();
  };

  const choose = async (file: File | undefined): Promise<void> => {
    if (!file) return;

    const result = readBackup(await file.text());

    if (!result.ok) {
      notificationService.error('Não deu para ler', BACKUP_PROBLEMS[result.problem]);
      return;
    }

    // Só se confirma depois de o ficheiro estar lido: perguntar antes era
    // pedir uma decisão sobre uma coisa que ainda podia nem servir.
    setPending(result.backup);
  };

  const confirm = async (): Promise<void> => {
    if (!pending) return;

    setWorking(true);

    try {
      const sections = await restoreBackup(pending);
      setPending(null);
      notificationService.success(
        'Cópia reposta',
        `${sections} ${sections === 1 ? 'secção' : 'secções'} de volta. A chave da API não vem nas cópias — volte a colá-la na Personalização.`,
      );
    } finally {
      setWorking(false);
    }
  };

  const secretCount = SECRET_FIELDS[STORAGE_KEYS.aiSettings]?.length ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <p className="mb-2 text-[11.5px] leading-[1.5] text-t3">
        Tudo o que o JARVIS sabe de si — temas, layouts, widgets, conversas, memória, tarefas,
        automações e plugins — vive no armazenamento local deste dispositivo. Limpar os dados do
        browser apaga tudo isso.
      </p>
      <p className="mb-s3 text-[11.5px] leading-[1.5] text-t3">
        A cópia é um ficheiro JSON legível, para se poder abrir e ver o que lá está.{' '}
        {secretCount > 0 && (
          <>
            <span className="text-t2">A chave da API não vai lá dentro</span> — é um segredo, e um
            ficheiro que se descarrega acaba em sítios que não se controlam.
          </>
        )}
      </p>

      <div className="mb-s3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void download()}
          disabled={isWorking}
          className={cn(
            'flex items-center gap-2 rounded-btn border border-line px-3.5 py-2',
            'text-[12.5px] font-medium text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:bg-accent/[.05] hover:text-accent active:scale-[.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Descarregar uma cópia
        </button>

        <button
          type="button"
          onClick={() => void importFromFile()}
          disabled={isWorking}
          className={cn(
            'flex items-center gap-2 rounded-btn border border-line px-3.5 py-2',
            'text-[12.5px] font-medium text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:bg-accent/[.05] hover:text-accent active:scale-[.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Repor de um ficheiro
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Ficheiro da cópia de segurança"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            // Limpar o campo: escolher o mesmo ficheiro duas vezes seguidas
            // não dispara `change` outra vez se o valor não mudar.
            event.target.value = '';
          }}
        />
      </div>

      {pending && (
        <div className="rounded-card border border-warn/30 bg-warn/[.06] p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 flex-shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[12.5px] font-medium">Isto substitui o que está agora</p>
          </div>

          <p className="mb-1.5 text-[11.5px] leading-[1.5] text-t3">
            Cópia de{' '}
            {pending.createdAt > 0
              ? new Date(pending.createdAt).toLocaleString('pt-PT')
              : 'data desconhecida'}
            , com {Object.keys(pending.data).length} secções.
          </p>

          <ul className="mb-2.5 flex flex-wrap gap-1">
            {Object.keys(pending.data)
              .sort()
              .map((key) => (
                <li
                  key={key}
                  className="mono rounded border border-line px-1.5 py-0.5 text-[10.5px] text-t3"
                >
                  {key}
                </li>
              ))}
          </ul>

          <p className="mb-2.5 text-[11.5px] leading-[1.5] text-t3">
            O que a cópia não traz fica como está — repor uma cópia antiga é um passo atrás, não um
            recomeço.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className={cn(
                'rounded-btn border border-line px-3 py-1.5 text-[12px] text-t2',
                'transition-colors duration-hover hover:text-t1',
              )}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => void confirm()}
              disabled={isWorking}
              className={cn(
                'rounded-btn border border-warn/40 bg-warn/[.1] px-3 py-1.5',
                'text-[12px] font-medium text-warn transition-all duration-hover ease-out',
                'hover:bg-warn/[.18] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Repor esta cópia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
