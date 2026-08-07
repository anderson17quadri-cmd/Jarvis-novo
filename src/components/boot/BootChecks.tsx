import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/hooks/use-media-query';
import { soundService } from '@/services/sound-service';
import { BOOT_STEPS, BOOT_TIMING } from './boot-steps';

interface CheckState {
  /** A linha já apareceu. */
  readonly entered: boolean;
  /** A verificação terminou. */
  readonly done: boolean;
  /** Duração em ms, mostrada à direita. */
  readonly durationMs: number;
}

interface BootChecksProps {
  readonly onComplete: () => void;
}

/**
 * As 10 verificações do arranque.
 *
 * Cada uma entra, enche a barra e fica concluída com um tempo. Os tempos são
 * aleatórios entre 40 e 220ms de propósito: um arranque em que tudo demora
 * exatamente o mesmo nota-se logo que é encenação.
 */
export function BootChecks({ onComplete }: BootChecksProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const [states, setStates] = useState<readonly CheckState[]>(() =>
    BOOT_STEPS.map(() => ({ entered: false, done: false, durationMs: 0 })),
  );

  useEffect(() => {
    if (reducedMotion) {
      setStates(BOOT_STEPS.map(() => ({ entered: true, done: true, durationMs: 0 })));
      onComplete();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_STEPS.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setStates((previous) =>
            previous.map((state, i) => (i === index ? { ...state, entered: true } : state)),
          );

          timers.push(
            setTimeout(() => {
              const durationMs = 40 + Math.round(Math.random() * 180);
              setStates((previous) =>
                previous.map((state, i) =>
                  i === index ? { ...state, done: true, durationMs } : state,
                ),
              );
              // Um clique por verificação — dez, a 190ms de distância uma da
              // outra, é o ritmo da própria checklist a marcar passagem.
              soundService.play('click');

              if (index === BOOT_STEPS.length - 1) {
                timers.push(setTimeout(onComplete, 400));
              }
            }, BOOT_TIMING.stepDuration),
          );
        }, index * BOOT_TIMING.stepStagger),
      );
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <ul className="flex w-[min(460px,92vw)] flex-col gap-[9px]" aria-label="Verificações de arranque">
      {BOOT_STEPS.map((step, index) => {
        const state = states[index] ?? { entered: false, done: false, durationMs: 0 };

        return (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-[11px] text-[13px] transition-all duration-300 ease-out',
              state.entered ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
              state.done ? 'text-t2' : 'text-t3',
            )}
          >
            <span className={cn('flex h-4 w-4 flex-shrink-0', state.done ? 'text-ok' : 'text-t3')}>
              {state.done ? <Check className="h-full w-full" /> : <Circle className="h-full w-full" />}
            </span>

            <span className="flex-1">{step.label}</span>

            <span className="h-[2px] w-[74px] overflow-hidden rounded-full bg-tint/[.07]">
              <span
                className="block h-full bg-accent shadow-[0_0_8px_rgba(0,207,255,.6)] transition-[width] duration-[420ms] ease-out"
                style={{ width: state.entered ? '100%' : '0%' }}
              />
            </span>

            <span className="mono w-[46px] text-right text-[11px] text-t3">
              {state.done ? `${state.durationMs}ms` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
