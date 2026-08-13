import { useState } from 'react';
import { AlertTriangle, FolderOpen, X } from 'lucide-react';

import { useMusicSettings } from '@/hooks/use-music-settings';
import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { useMusicSettingsStore } from '@/stores/use-music-settings-store';

/**
 * Música local (Peça 8, lote 2).
 *
 * Ao contrário da meteorologia, das notícias e do correio, aqui não há rede
 * nenhuma: escolhe-se uma pasta do disco e o widget passa a tocar os ficheiros
 * de áudio que lá estiverem. Por isso não há chave, não há conta, não há cofre
 * — só um caminho. Sem pasta, mantém-se a reprodução simulada de sempre.
 */
export function MusicSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useMusicSettings();

  const capabilities = useCapabilities();
  const settings = useMusicSettingsStore((state) => state.settings);
  const setRoot = useMusicSettingsStore((state) => state.setRoot);
  const clearRoot = useMusicSettingsStore((state) => state.clearRoot);

  const [error, setError] = useState<string | null>(null);
  const hasRoot = settings.rootPath.trim().length > 0;

  if (!capabilities.music) {
    return (
      <p className="rounded-input border border-line bg-tint/[.02] p-2.5 text-cap leading-relaxed text-t3">
        A reprodução de música local não está disponível nesta plataforma — o widget continua
        com a reprodução simulada.
      </p>
    );
  }

  async function handlePickRoot(): Promise<void> {
    const adapter = getPlatformAdapter();
    const picked = await adapter.pickFilesRoot();
    if (!picked) return;

    // Declarar a pasta valida-a (tem de existir e ser legível) e devolve o
    // nome, que é o que se mostra sem o caminho inteiro.
    const declared = await adapter.musicSetRoot(picked);
    if (!declared) {
      setError('Não consegui usar essa pasta.');
      return;
    }

    setError(null);
    setRoot(declared.path, declared.name);
  }

  return (
    <div className="flex flex-col gap-s3">
      <p
        className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
        role="note"
      >
        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
        <span>
          A música lê uma pasta sua, neste dispositivo — nada sai para a rede, e o widget só
          acede aos ficheiros de áudio dentro dessa pasta. Sem pasta escolhida, mantém-se a
          reprodução simulada.
        </span>
      </p>

      {hasRoot ? (
        <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-t3">Pasta de música</span>
            <span className="block truncate text-[12px] font-medium">{settings.rootName}</span>
            <span className="mono block truncate text-[10px] text-t3">{settings.rootPath}</span>
          </span>

          <button
            type="button"
            onClick={clearRoot}
            aria-label="Limpar a pasta de música"
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
          Escolher pasta de música…
        </button>
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-input border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-cap text-warn">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <span className="text-cap text-t3">
        O widget passa a tocar os ficheiros de áudio dessa pasta — mp3, wav, ogg, flac, m4a, aac
        e opus. A capa e a duração são descobertas à medida que cada faixa toca.
      </span>
    </div>
  );
}
