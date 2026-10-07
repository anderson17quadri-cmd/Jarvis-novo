import { getPlatformAdapter } from '@/platform';
import { seedFiles } from '@/data/files';
import { normalizeSearch } from '@/utils/text';
import { searchFiles } from '@/types/file-entry';
import type { RealFilesRoot } from '@/types/real-file-entry';

export const REAL_ROOT_STORAGE_KEY = 'files.real-root-path';
export interface AssistantFileMatch {
  readonly name: string;
  readonly pathNames: readonly string[];
  readonly examplePath?: readonly string[];
  readonly realParents?: readonly RealFilesRoot[];
}
export interface AssistantFileSearch {
  readonly source: 'real' | 'exemplo' | 'indisponível';
  readonly matches: readonly AssistantFileMatch[];
  readonly isTruncated: boolean;
}

export async function searchAssistantFiles(query: string): Promise<AssistantFileSearch> {
  const adapter = getPlatformAdapter();
  const needle = normalizeSearch(query).trim();
  if (!needle) return { source: 'indisponível', matches: [], isTruncated: false };
  const saved = adapter.capabilities.realFilesystem
    ? await adapter.storageGet<string | null>(REAL_ROOT_STORAGE_KEY, null) : null;
  if (!saved) return { source: 'exemplo', isTruncated: false,
    matches: searchFiles(seedFiles(), query, normalizeSearch).map(match => ({
      name: match.entry.name, pathNames: match.pathNames, examplePath: match.path,
    })) };
  const root = await adapter.filesSetRoot(saved);
  if (!root) return { source: 'indisponível', matches: [], isTruncated: false };
  const queue: { path: string; parents: readonly RealFilesRoot[] }[] = [{ path: root.path, parents: [root] }];
  const visited = new Set<string>();
  const matches: AssistantFileMatch[] = [];
  let scanned = 0;
  let isTruncated = false;
  const deadline = Date.now() + 8000;
  while (queue.length > 0 && visited.size < 100 && scanned < 5000 && matches.length < 40 && Date.now() < deadline) {
    const folder = queue.shift()!;
    const key = folder.path.replace(/\\/g, '/').toLowerCase();
    if (visited.has(key)) continue;
    visited.add(key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const entries = await Promise.race([
      adapter.filesReadDir(folder.path),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())); }),
    ]);
    clearTimeout(timer);
    if (entries === null) { isTruncated = true; continue; }
    for (const entry of entries) {
      if (++scanned > 5000 || matches.length >= 40) { isTruncated = true; break; }
      if (normalizeSearch(entry.name).includes(needle)) matches.push({
        name: entry.name, pathNames: folder.parents.map(parent => parent.name), realParents: folder.parents,
      });
      if (entry.isDirectory) {
        if (folder.parents.length >= 12) isTruncated = true;
        else queue.push({ path: entry.path, parents: [...folder.parents, { name: entry.name, path: entry.path }] });
      }
    }
  }
  if (queue.length > 0) isTruncated = true;
  if (await adapter.storageGet<string | null>(REAL_ROOT_STORAGE_KEY, null) !== saved) {
    return { source: 'indisponível', matches: [], isTruncated: true };
  }
  return { source: 'real', matches, isTruncated };
}
