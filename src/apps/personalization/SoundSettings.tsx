import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

import { cn } from '@/lib/cn';
import { soundService } from '@/services/sound-service';

/**
 * Sons do sistema (Parte 9 §Som).
 *
 * Estado local em vez de store: o `soundService` é a fonte de verdade — quem
 * toca os sons é ele, e duplicar a preferência num store só criava dois sítios
 * para a mesma coisa. Este componente é a única interface que a lê.
 */
export function SoundSettings(): React.JSX.Element {
  const [isEnabled, setEnabled] = useState(() => soundService.isEnabled);
  const [volume, setVolume] = useState(() => soundService.currentVolume);

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        onClick={() => {
          const next = !isEnabled;
          soundService.setEnabled(next);
          setEnabled(next);
          void soundService.persist();
          // Ligar toca um som: é a prova de que ficou ligado, e a confirmação
          // mais direta possível.
          if (next) soundService.play('success');
        }}
        className={cn(
          'flex min-h-[36px] w-full items-center gap-2 rounded-input border border-line px-3 py-2',
          'text-[12.5px] text-t2 transition-all duration-hover ease-out',
          'hover:border-accent/35 hover:text-accent compact:min-h-[44px]',
          isEnabled && 'border-accent/50 bg-accent/[.06] text-accent',
        )}
      >
        {isEnabled ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
        {isEnabled ? 'Sons ligados' : 'Sons desligados'}
      </button>

      {isEnabled && (
        <label className="mt-2.5 flex items-center gap-2.5">
          <span className="text-[11.5px] text-t3">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              soundService.setVolume(next);
              setVolume(next);
            }}
            // Ouvir enquanto se arrasta seria irritante; ouvir ao largar é útil.
            onPointerUp={() => {
              soundService.play('click');
              void soundService.persist();
            }}
            className="jarvis-range flex-1"
          />
          <span className="mono w-[34px] text-right text-[11px] text-t3">
            {Math.round(volume * 100)}%
          </span>
        </label>
      )}

      <p className="mt-2 text-cap text-t3">
        Sons sintetizados no momento — não há ficheiros de áudio no pacote. Todos abaixo dos
        120 ms, para nunca competirem com música.
      </p>
    </div>
  );
}
