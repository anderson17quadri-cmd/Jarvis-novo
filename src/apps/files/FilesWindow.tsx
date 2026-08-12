import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  FileArchive,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Info,
  Loader2,
  Music,
  Undo2,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { seedFiles } from '@/data/files';
import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { formatBytes, formatShortDate } from '@/lib/format';
import { getPlatformAdapter } from '@/platform';
import { usePendingFileNavigationStore } from '@/stores/use-pending-file-navigation-store';
import { fileKindFromName, resolvePath, type FileEntry, type FileKind } from '@/types/file-entry';
import type { RealFilesRoot } from '@/types/real-file-entry';

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

/** Uma migalha de caminho, simulada ou real — o resto do componente não distingue. */
interface Crumb {
  readonly id: string;
  readonly name: string;
}

/** Uma linha da lista, simulada ou real — unificada para haver só um `<ul>`. */
interface Row {
  readonly key: string;
  readonly name: string;
  readonly kind: FileKind;
  readonly sizeBytes: number | null;
  readonly modifiedAt: number;
  readonly isFolder: boolean;
}

/** Onde fica guardado o caminho da última pasta-raiz real escolhida. */
const REAL_ROOT_STORAGE_KEY = 'files.real-root-path';

/**
 * Explorador de ficheiros.
 *
 * Dois modos, nunca misturados numa pasta só:
 *
 * - **Simulado** (por omissão): a árvore inventada em `data/files.ts`. Não
 *   toca no disco — é o que fica quando a plataforma não tem acesso real
 *   (`capabilities.realFilesystem`) ou quando ninguém escolheu uma pasta.
 * - **Real**: depois de a pessoa escolher uma pasta-raiz pelo diálogo
 *   nativo, a navegação passa a ler o disco a sério, um nível de cada vez
 *   (`files_read_dir` no Rust). A raiz fica guardada — reabre-se sozinha da
 *   próxima vez, e se a pasta tiver desaparecido cai-se de volta ao
 *   simulado em silêncio, sem um erro que ninguém pediu para ver.
 *
 * O caminho pendente do assistente (`usePendingFileNavigationStore`, de
 * "abrir esse ficheiro") só conhece a árvore simulada — se existir um
 * pedido pendente na primeira leitura, a reabertura da raiz real espera
 * pela próxima montagem em vez de o atropelar.
 */
export default function FilesWindow(): React.JSX.Element {
  const root = useMemo(() => seedFiles(), []);
  const capabilities = useCapabilities();

  // ── Modo simulado ────────────────────────────────────────────────────────
  const [initialPendingPath] = useState<readonly string[] | null>(
    () => usePendingFileNavigationStore.getState().consume(),
  );
  const [path, setPath] = useState<readonly string[]>(() => initialPendingPath ?? []);
  const [sortBy, setSortBy] = useState<SortBy>('nome');

  // ── Modo real ────────────────────────────────────────────────────────────
  const [realRoot, setRealRoot] = useState<RealFilesRoot | null>(null);
  const [realCrumbs, setRealCrumbs] = useState<readonly { readonly name: string; readonly path: string }[]>(
    [],
  );
  const [realRows, setRealRows] = useState<readonly Row[] | null>(null);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState<string | null>(null);

  const isReal = realRoot !== null;

  // Ao arrancar: se a plataforma suportar e não houver um caminho pendente
  // do assistente a pedir a árvore simulada, tenta reabrir a última raiz
  // real guardada. Uma pasta que desapareceu entretanto não é um erro para
  // mostrar — cai-se de volta ao simulado como se nunca tivesse havido raiz.
  useEffect(() => {
    if (!capabilities.realFilesystem || initialPendingPath !== null) return;

    let cancelled = false;

    async function restore(): Promise<void> {
      const adapter = getPlatformAdapter();
      const savedPath = await adapter.storageGet<string | null>(REAL_ROOT_STORAGE_KEY, null);
      if (!savedPath || cancelled) return;

      const declared = await adapter.filesSetRoot(savedPath);
      if (cancelled) return;

      if (!declared) {
        await adapter.storageRemove(REAL_ROOT_STORAGE_KEY);
        return;
      }

      setRealRoot(declared);
      setRealCrumbs([{ name: declared.name, path: declared.path }]);
    }

    void restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentRealPath = realCrumbs.at(-1)?.path ?? null;

  // Carrega a pasta real atual sempre que o caminho muda.
  useEffect(() => {
    if (!isReal || currentRealPath === null) return;

    let cancelled = false;
    setRealLoading(true);
    setRealError(null);

    async function load(): Promise<void> {
      const entries = await getPlatformAdapter().filesReadDir(currentRealPath);
      if (cancelled) return;
      setRealLoading(false);

      if (entries === null) {
        setRealError('Não consegui ler esta pasta.');
        setRealRows(null);
        return;
      }

      setRealRows(
        entries.map((entry) => ({
          key: entry.path,
          name: entry.name,
          kind: fileKindFromName(entry.name, entry.isDirectory),
          sizeBytes: entry.sizeBytes,
          modifiedAt: entry.modifiedAt,
          isFolder: entry.isDirectory,
        })),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isReal, currentRealPath]);

  const handlePickRoot = useCallback(async () => {
    const adapter = getPlatformAdapter();
    const picked = await adapter.pickFilesRoot();
    if (!picked) return;

    const declared = await adapter.filesSetRoot(picked);
    if (!declared) {
      setRealError('Não consegui usar essa pasta.');
      return;
    }

    await adapter.storageSet(REAL_ROOT_STORAGE_KEY, declared.path);
    setRealRows(null);
    setRealError(null);
    setRealRoot(declared);
    setRealCrumbs([{ name: declared.name, path: declared.path }]);
  }, []);

  const handleLeaveReal = useCallback(() => {
    setRealRoot(null);
    setRealRows(null);
    setRealCrumbs([]);
    setRealError(null);
    void getPlatformAdapter().storageRemove(REAL_ROOT_STORAGE_KEY);
  }, []);

  // ── Linhas e migalhas, unificadas ────────────────────────────────────────

  const simulatedRows: readonly Row[] = useMemo(() => {
    const level = resolvePath(root, path);
    return level.map((entry) => ({
      key: entry.id,
      name: entry.name,
      kind: entry.kind,
      sizeBytes: entry.sizeBytes,
      modifiedAt: entry.modifiedAt,
      isFolder: entry.kind === 'pasta',
    }));
  }, [path, root]);

  const sortedRows = useMemo(() => {
    const rows = isReal ? realRows ?? [] : simulatedRows;

    return [...rows].sort((a, b) => {
      // As pastas ficam sempre à frente, seja qual for a ordenação — é o que
      // qualquer explorador faz, e sem isso a lista fica difícil de percorrer.
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;

      if (sortBy === 'data') return b.modifiedAt - a.modifiedAt;
      if (sortBy === 'tamanho') return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      return a.name.localeCompare(b.name, 'pt');
    });
  }, [isReal, realRows, simulatedRows, sortBy]);

  const simulatedCrumbs: readonly Crumb[] = useMemo(() => {
    const names: Crumb[] = [];
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
        {isReal ? (
          <>
            {realCrumbs.map((crumb, index) => (
              <span key={crumb.path} className="flex items-center gap-0.5">
                {index > 0 && <ChevronRight className="h-3 w-3 text-t3" aria-hidden="true" />}
                <CrumbButton
                  onClick={() => setRealCrumbs(realCrumbs.slice(0, index + 1))}
                  isActive={index === realCrumbs.length - 1}
                >
                  {crumb.name}
                </CrumbButton>
              </span>
            ))}
          </>
        ) : (
          <>
            <CrumbButton onClick={() => setPath([])} isActive={path.length === 0}>
              Início
            </CrumbButton>

            {simulatedCrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3 text-t3" aria-hidden="true" />
                <CrumbButton
                  onClick={() => setPath(path.slice(0, index + 1))}
                  isActive={index === simulatedCrumbs.length - 1}
                >
                  {crumb.name}
                </CrumbButton>
              </span>
            ))}
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {isReal ? (
            <button
              type="button"
              onClick={handleLeaveReal}
              className={cn(
                'flex items-center gap-1 rounded-input border border-line bg-glass px-2 py-1.5',
                'text-[11px] text-t2 transition-colors duration-hover hover:text-accent',
              )}
            >
              <Undo2 className="h-3 w-3" aria-hidden="true" />
              Árvore simulada
            </button>
          ) : (
            capabilities.realFilesystem && (
              <button
                type="button"
                onClick={() => void handlePickRoot()}
                className={cn(
                  'flex items-center gap-1 rounded-input border border-line bg-glass px-2 py-1.5',
                  'text-[11px] text-t2 transition-colors duration-hover hover:text-accent',
                )}
              >
                <FolderOpen className="h-3 w-3" aria-hidden="true" />
                Escolher pasta real…
              </button>
            )
          )}

          <label>
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
        </div>
      </nav>

      {realError && (
        <p className="flex flex-shrink-0 items-center gap-1.5 rounded-input border border-warn/30 bg-warn/10 px-2 py-1.5 text-cap text-warn">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {realError}
        </p>
      )}

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {isReal && realLoading && (
          <li className="flex items-center justify-center gap-1.5 py-s3 text-desc text-t3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A ler a pasta…
          </li>
        )}

        {!(isReal && realLoading) &&
          sortedRows.map((row) => {
            const Icon = KIND_ICON[row.kind];

            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (!row.isFolder) return;
                    if (isReal) {
                      setRealCrumbs([...realCrumbs, { name: row.name, path: row.key }]);
                    } else {
                      setPath([...path, row.key]);
                    }
                  }}
                  // Um ficheiro não abre: não há aplicação para o abrir.
                  disabled={!row.isFolder}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-input border border-transparent px-2 py-2 text-left',
                    'transition-colors duration-hover',
                    row.isFolder
                      ? 'hover:border-line hover:bg-tint/[.03]'
                      : 'cursor-default disabled:opacity-90',
                    'compact:py-2.5',
                  )}
                >
                  <Icon
                    className={cn('h-4 w-4 flex-shrink-0', row.isFolder ? 'text-accent' : 'text-t3')}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{row.name}</span>

                  <span className="mono flex-shrink-0 text-[10.5px] text-t3">
                    {row.sizeBytes === null ? '—' : formatBytes(row.sizeBytes)}
                  </span>
                  {/* A data é a primeira coisa a sair num ecrã estreito: o nome
                      e o tamanho chegam para escolher um ficheiro. */}
                  <span className="mono flex-shrink-0 text-[10.5px] text-t3 tight:hidden">
                    {formatShortDate(new Date(row.modifiedAt))}
                  </span>
                </button>
              </li>
            );
          })}

        {!(isReal && realLoading) && sortedRows.length === 0 && (
          <li className="py-s3 text-center text-desc text-t3">Pasta vazia.</li>
        )}
      </ul>

      <p className="flex flex-shrink-0 items-start gap-1.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        {isReal && realRoot ? (
          <span>
            Pasta real: <span className="mono">{realRoot.path}</span>. Só o que está dentro dela
            fica acessível.
          </span>
        ) : (
          <span>
            Árvore simulada — nada aqui toca no disco.
            {capabilities.realFilesystem &&
              ' Escolha uma pasta real, acima, para navegar a sério.'}
            {!capabilities.realFilesystem &&
              (capabilities.fileDialogs
                ? ' Esta plataforma não liga a leitura real do disco.'
                : ' Esta plataforma nem sequer expõe diálogos de ficheiro.')}
          </span>
        )}
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
