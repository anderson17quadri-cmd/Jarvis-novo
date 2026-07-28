import { useMemo, useState } from 'react';
import {
  ChevronRight,
  FileArchive,
  FileCode,
  FileText,
  Folder,
  Image,
  Info,
  Music,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { seedFiles } from '@/data/files';
import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { formatBytes, formatShortDate } from '@/lib/format';
import { resolvePath, type FileEntry, type FileKind } from '@/types/file-entry';

const KIND_ICON: Record<FileKind, LucideIcon> = {
  pasta: Folder,
  documento: FileText,
  imagem: Image,
  video: Video,
  audio: Music,
  codigo: FileCode,
  arquivo: FileArchive,
};

/** Ordenações disponíveis. */
type SortBy = 'nome' | 'data' | 'tamanho';

/**
 * Explorador de ficheiros.
 *
 * **A árvore é simulada.** Não há leitura de disco nenhuma: isso exige o plugin
 * `fs` do Tauri e diálogos nativos, bloqueados até haver PC (`SPEC.md` §2). O
 * que fica pronto e testado é a navegação, o histórico de caminho e a
 * ordenação — quando a leitura real chegar, muda a origem dos dados.
 */
export default function FilesWindow(): React.JSX.Element {
  const root = useMemo(() => seedFiles(), []);
  const [path, setPath] = useState<readonly string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('nome');
  const capabilities = useCapabilities();

  const entries = useMemo(() => {
    const level = resolvePath(root, path);

    return [...level].sort((a, b) => {
      // As pastas ficam sempre à frente, seja qual for a ordenação — é o que
      // qualquer explorador faz, e sem isso a lista fica difícil de percorrer.
      if ((a.kind === 'pasta') !== (b.kind === 'pasta')) return a.kind === 'pasta' ? -1 : 1;

      if (sortBy === 'data') return b.modifiedAt - a.modifiedAt;
      if (sortBy === 'tamanho') return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      return a.name.localeCompare(b.name, 'pt');
    });
  }, [path, root, sortBy]);

  /** Nomes do caminho atual, para as migalhas. */
  const crumbs = useMemo(() => {
    const names: { readonly id: string; readonly name: string }[] = [];
    let level: readonly FileEntry[] = root;

    for (const id of path) {
      const entry = level.find((candidate) => candidate.id === id);
      if (!entry) break;
      names.push({ id: entry.id, name: entry.name });
      level = entry.children ?? [];
    }

    return names;
  }, [path, root]);

  return (
    <div className="flex h-full flex-col gap-s2">
      <nav aria-label="Caminho" className="flex flex-shrink-0 flex-wrap items-center gap-0.5">
        <CrumbButton onClick={() => setPath([])} isActive={path.length === 0}>
          Início
        </CrumbButton>

        {crumbs.map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-0.5">
            <ChevronRight className="h-3 w-3 text-t3" aria-hidden="true" />
            <CrumbButton
              onClick={() => setPath(path.slice(0, index + 1))}
              isActive={index === crumbs.length - 1}
            >
              {crumb.name}
            </CrumbButton>
          </span>
        ))}

        <label className="ml-auto">
          <span className="sr-only">Ordenar por</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className={cn(
              'rounded-input border border-line bg-glass px-2 py-1.5',
              'text-[11px] text-t2 outline-none focus:border-accent/45',
            )}
          >
            <option value="nome">Nome</option>
            <option value="data">Data</option>
            <option value="tamanho">Tamanho</option>
          </select>
        </label>
      </nav>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {entries.map((entry) => {
          const Icon = KIND_ICON[entry.kind];
          const isFolder = entry.kind === 'pasta';

          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  if (isFolder) setPath([...path, entry.id]);
                }}
                // Um ficheiro não abre: não há aplicação para o abrir nem
                // leitura de disco. Fica sem ação em vez de fingir uma.
                disabled={!isFolder}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-input border border-transparent px-2 py-2 text-left',
                  'transition-colors duration-hover',
                  isFolder
                    ? 'hover:border-line hover:bg-tint/[.03]'
                    : 'cursor-default disabled:opacity-90',
                  'compact:py-2.5',
                )}
              >
                <Icon
                  className={cn('h-4 w-4 flex-shrink-0', isFolder ? 'text-accent' : 'text-t3')}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1 truncate text-[12.5px]">{entry.name}</span>

                <span className="mono flex-shrink-0 text-[10.5px] text-t3">
                  {entry.sizeBytes === null ? '—' : formatBytes(entry.sizeBytes)}
                </span>
                {/* A data é a primeira coisa a sair num ecrã estreito: o nome
                    e o tamanho chegam para escolher um ficheiro. */}
                <span className="mono flex-shrink-0 text-[10.5px] text-t3 tight:hidden">
                  {formatShortDate(new Date(entry.modifiedAt))}
                </span>
              </button>
            </li>
          );
        })}

        {entries.length === 0 && (
          <li className="py-s3 text-center text-desc text-t3">Pasta vazia.</li>
        )}
      </ul>

      <p className="flex flex-shrink-0 items-start gap-1.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Árvore simulada — nada aqui toca no disco.
          {capabilities.fileDialogs
            ? ' Os diálogos nativos existem nesta plataforma, mas a leitura real ainda não está ligada.'
            : ' Esta plataforma nem sequer expõe diálogos de ficheiro.'}
        </span>
      </p>
    </div>
  );
}

function CrumbButton({
  onClick,
  isActive,
  children,
}: {
  readonly onClick: () => void;
  readonly isActive: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'rounded px-1.5 py-1 text-[11.5px] transition-colors duration-hover',
        isActive ? 'text-t1' : 'text-t3 hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}
