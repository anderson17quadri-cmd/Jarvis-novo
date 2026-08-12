import { useEffect } from 'react';
import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from 'lucide-react';

import { WidgetEmpty, WidgetSkeleton } from '@/components/widgets/WidgetStates';
import { useIsVisible } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { musicService } from '@/services/music/music-service';
import { useMusicStore } from '@/stores/use-music-store';

/** Segundos em `m:ss`. */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Música (Parte 6.2 §Widgets previstos).
 *
 * Capa, faixa, artista, progresso e controlos. **Não reproduz áudio** — modela
 * e controla o estado. A capa é um gradiente gerado a partir da faixa: sem rede
 * não há imagens, e um retângulo a dizer "sem capa" seria pior.
 */
export default function MusicWidget(): React.JSX.Element {
  const snapshot = useMusicStore((s) => s.snapshot);
  const isLoadingStore = useMusicStore((s) => s.isLoading);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const next = useMusicStore((s) => s.next);
  const previous = useMusicStore((s) => s.previous);
  const seek = useMusicStore((s) => s.seek);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const toggleRepeat = useMusicStore((s) => s.toggleRepeat);
  const isVisible = useIsVisible();

  useEffect(() => {
    const unsub = useMusicStore.getState().hydrate();
    return unsub;
  }, []);

  useEffect(() => {
    musicService.setPaused(!isVisible);
  }, [isVisible]);

  if (isLoadingStore || !snapshot) return <WidgetSkeleton />;
  if (!snapshot.track) return <WidgetEmpty message="Nenhuma faixa em reprodução." />;

  const { track, status, positionSec } = snapshot;
  const isPlaying = status === 'playing';

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 items-center gap-3">
        <div
          className="h-14 w-14 flex-shrink-0 rounded-lg shadow-1"
          style={{
            background: `linear-gradient(140deg, ${track.artwork[0]}, ${track.artwork[1]})`,
          }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{track.title}</p>
          <p className="truncate text-[11px] text-t2">{track.artist}</p>
          <p className="truncate text-[10px] text-t3">{track.album}</p>
        </div>
      </div>

      <div className="mt-2 flex-shrink-0">
        <label className="sr-only" htmlFor="music-progress">
          Posição da faixa
        </label>
        <input
          id="music-progress"
          type="range"
          min={0}
          max={track.durationSec}
          value={Math.floor(positionSec)}
          onChange={(event) => void seek(Number(event.target.value))}
          className="music-range w-full"
        />

        <div className="mono mt-0.5 flex justify-between text-[9.5px] text-t3">
          <span>{formatDuration(positionSec)}</span>
          <span>{formatDuration(track.durationSec)}</span>
        </div>
      </div>

      <div className="mt-1.5 flex flex-shrink-0 items-center justify-center gap-1">
        <ControlButton
          label="Reprodução aleatória"
          isActive={snapshot.isShuffle}
          onClick={() => void toggleShuffle()}
        >
          <Shuffle />
        </ControlButton>

        <ControlButton label="Faixa anterior" onClick={() => void previous()}>
          <SkipBack />
        </ControlButton>

        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label={isPlaying ? 'Pausa' : 'Reproduzir'}
          className={cn(
            'mx-1 flex h-9 w-9 items-center justify-center rounded-full',
            'bg-accent text-[#04121A] transition-all duration-hover ease-out',
            'hover:shadow-glow active:scale-95',
          )}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <ControlButton label="Faixa seguinte" onClick={() => void next()}>
          <SkipForward />
        </ControlButton>

        <ControlButton
          label="Repetir"
          isActive={snapshot.isRepeat}
          onClick={() => void toggleRepeat()}
        >
          <Repeat />
        </ControlButton>
      </div>

      {snapshot.isSimulated && (
        <p className="mt-1 flex-shrink-0 text-center text-[9.5px] text-t3">
          Sem áudio — reprodução simulada
        </p>
      )}
    </div>
  );
}

interface ControlButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly isActive?: boolean;
}

function ControlButton({
  label,
  onClick,
  children,
  isActive = false,
}: ControlButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-hover',
        '[&>svg]:h-3.5 [&>svg]:w-3.5',
        isActive ? 'text-accent' : 'text-t3 hover:text-t1',
      )}
    >
      {children}
    </button>
  );
}
