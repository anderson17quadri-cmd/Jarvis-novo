import { useState } from 'react';
import { AlertTriangle, BookOpen, FolderOpen, X } from 'lucide-react';

import { useObsidianSettings } from '@/hooks/use-obsidian-settings';
import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { obsidianService } from '@/services/knowledge/obsidian-service';
import { useObsidianSettingsStore } from '@/stores/use-obsidian-settings-store';

/**
 * Vault Obsidian (Peça 17).
 *
 * O mesmo desenho da Música: escolhe-se uma pasta do disco, sem chave nem
 * conta nem cofre — só um caminho. A diferença é o que essa pasta dá ao
 * assistente: memória persistente a sério, notas que pode procurar, ler e
 * (com confirmação) escrever, em vez de um widget a tocar ficheiros.
 */
export function ObsidianSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useObsidianSettings();

  const capabilities = useCapabilities();
  const settings = useObsidianSettingsStore((state) => state.settings);
  const setRoot = useObsidianSettingsStore((state) => state.setRoot);
  const clearRoot = useObsidianSettingsStore((state) => state.clearRoot);

  const [error, setError] = useState<string | null>(null);
  const hasRoot = settings.rootPath.trim().length > 0;

  if (!capabilities.obsidian) {
    return (
      <p className="rounded-input border border-line bg-tint/[.02] p-2.5 text-cap leading-relaxed text-t3">
        O vault Obsidian não está disponível nesta plataforma.
      </p>
    );
  }

  async function handlePickRoot(): Promise<void> {
    const adapter = getPlatformAdapter();
    const picked = await adapter.pickFilesRoot();
    if (!picked) return;

    const declared = await adapter.obsidianSetRoot(picked);
    if (!declared) {
      setError('Não consegui usar essa pasta.');
      return;
    }

    setError(null);
    setRoot(declared.path, declared.name);
    await obsidianService.refreshNotes();
  }

  return (
    <div className="flex flex-col gap-s3">
      <p
        className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
        role="note"
      >
        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
        <span>
          O assistente passa a poder procurar, ler e (com a tua confirmação) escrever notas nesta
          pasta — nada sai para a rede. Sem pasta escolhida, o assistente não tem memória
          persistente nenhuma além do que já guarda por palavras.
        </span>
      </p>

      {hasRoot ? (
        <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-t3">Vault Obsidian</span>
            <span className="block truncate text-[12px] font-medium">{settings.rootName}</span>
            <span className="mono block truncate text-[10px] text-t3">{settings.rootPath}</span>
          </span>

          <button
            type="button"
            onClick={clearRoot}
            aria-label="Limpar o vault Obsidian"
            className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-danger"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handlePickRoot()}
          className={cn(
            'flex w-full items-center gap-2 rounded-input border border-line px-3 py-2.5',
            'text-left text-[12.5px] font-medium text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:bg-accent/[.04] hover:text-accent active:scale-[.98]',
          )}
        >
          <FolderOpen className="h-4 w-4 text-accent" aria-hidden="true" />
          Escolher vault Obsidian…
        </button>
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-input border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-cap text-warn">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <span className="flex items-start gap-1.5 text-cap text-t3">
        <BookOpen className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        O assistente procura pelo título das notas (parcial, sem acentos) — nunca ingere o vault
        inteiro de uma vez. Notas novas criadas pelo assistente ficam no topo do vault; notas em
        subpastas continuam a procurar-se e a ler-se normalmente.
      </span>
    </div>
  );
}
