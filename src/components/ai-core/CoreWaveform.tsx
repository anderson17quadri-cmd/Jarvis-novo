import { useCallback, useRef } from 'react';

import { useAnimationFrame } from '@/hooks/use-animation-frame';
import type { AssistantMode } from '@/types/assistant';

/** Número de barras. */
const BAR_COUNT = 44;
const MIN_HEIGHT_PX = 3;

interface CoreWaveformProps {
  readonly mode: AssistantMode;
  readonly color: string;
}

/**
 * Waveform sob o núcleo.
 *
 * Cada modo tem a sua forma: "a ouvir" é ruído (o sinal vem de fora e é
 * imprevisível), "a responder" é uma onda contínua (o sinal é gerado), "a
 * analisar" é uma ondulação lenta e baixa. Em repouso, quase plana.
 *
 * As alturas são escritas em `style.height` diretamente nos elementos, não em
 * estado: são 44 elementos a mudar 60 vezes por segundo.
 */
export function CoreWaveform({ mode, color }: CoreWaveformProps): React.JSX.Element {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useAnimationFrame(
    useCallback(
      (elapsed: number) => {
        const middle = BAR_COUNT / 2;

        for (let index = 0; index < BAR_COUNT; index++) {
          const bar = barsRef.current[index];
          if (!bar) continue;

          // As barras centrais são sempre mais altas — dá forma de fuso.
          const centerFalloff = 1 - Math.abs(index - middle) / middle;
          bar.style.height = `${barHeight(mode, elapsed, index, centerFalloff).toFixed(1)}px`;
        }
      },
      [mode],
    ),
  );

  return (
    <div className="flex h-9 items-center justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            barsRef.current[index] = element;
          }}
          className="w-[3px] rounded-full transition-[background] duration-300"
          style={{
            minHeight: `${MIN_HEIGHT_PX}px`,
            background: color,
            boxShadow: `0 0 6px ${color}99`,
          }}
        />
      ))}
    </div>
  );
}

function barHeight(
  mode: AssistantMode,
  elapsed: number,
  index: number,
  centerFalloff: number,
): number {
  switch (mode) {
    case 'listening':
      return MIN_HEIGHT_PX + Math.random() * 28 * (0.3 + centerFalloff * 0.7);
    case 'speaking':
      return (
        MIN_HEIGHT_PX +
        (Math.sin(elapsed / 105 + index * 0.5) * 0.5 + 0.5) * 24 * (0.35 + centerFalloff * 0.65)
      );
    case 'thinking':
      return MIN_HEIGHT_PX + (Math.sin(elapsed / 230 + index * 0.38) * 0.5 + 0.5) * 10;
    case 'success':
      // Um arco cheio a partir do centro — lê-se como "concluído", não como som.
      return MIN_HEIGHT_PX + centerFalloff * 22;
    case 'idle':
    case 'error':
      return MIN_HEIGHT_PX + centerFalloff * 2;
  }
}
