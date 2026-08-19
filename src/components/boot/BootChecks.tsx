import { useEffect, useState } from 'react';
import { Check, Circle, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/hooks/use-media-query';
import { soundService } from '@/services/sound-service';
import { BOOT_DEBUG_FAIL_KEY, BOOT_STEPS, BOOT_TIMING } from './boot-steps';

interface CheckState {
  /** A linha já apareceu. */
  readonly entered: boolean;
  /** A verificação terminou. */
  readonly done: boolean;
  /** `true` quando a verificação falhou de propósito (modo de depuração). */
  readonly failed: boolean;
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
    BOOT_STEPS.map(() => ({ entered: false, done: false, failed: false, durationMs: 0 })),
  );

  // Modo de depuração: `sessionStorage.setItem('jarvis-debug.bootFailAt', '3')`
  // faz a verificação de índice 3 falhar. Só se lê uma vez, antes de a
  // sequência começar — mudar o valor a meio não teria efeito nenhum.
  const [failAt] = useState(() => readDebugFailFlag());

  useEffect(() => {
    // Com movimento reduzido não há sequência — só se avisa que terminou.
    if (reducedMotion) {
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
              const shouldFail = failAt.has(index);
              setStates((previous) =>
                previous.map((state, i) =>
                  i === index ? { ...state, done: true, failed: shouldFail, durationMs } : state,
                ),
              );
              // Um clique por verificação — dez, a 190ms de distância uma da
              // outra, é o ritmo da própria checklist a marcar passagem.
              // No modo de erro, troca-se para o som de erro na que falhou.
              soundService.play(shouldFail ? 'error' : 'click');

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

  // Com movimento reduzido mostra-se tudo já concluído, sem sincronizar nada
  // num efeito — o estado interno só existe para a sequência animada.
  const displayedStates: readonly CheckState[] = reducedMotion
    ? BOOT_STEPS.map((_, i) => ({ entered: true, done: true, failed: failAt.has(i), durationMs: 0 }))
    : states;

  return (
    <ul className="flex w-[min(460px,92vw)] flex-col gap-[9px]" aria-label="Verificações de arranque">
      {BOOT_STEPS.map((step, index) => {
        const state = displayedStates[index] ?? { entered: false, done: false, failed: false, durationMs: 0 };

        return (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-[11px] text-[13px] transition-all duration-300 ease-out',
              state.entered ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
              state.failed ? 'text-danger' : state.done ? 'text-t2' : 'text-t3',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 flex-shrink-0',
                state.failed ? 'text-danger' : state.done ? 'text-ok' : 'text-t3',
              )}
            >
              {state.failed ? (
                <X className="h-full w-full" />
              ) : state.done ? (
                <Check className="h-full w-full" />
              ) : (
                <Circle className="h-full w-full" />
              )}
            </span>

            <span className="flex-1">
              {step.label}
              {state.failed && (
                <span className="ml-2 text-[11px] text-danger/80">— falhou</span>
              )}
            </span>

            <span className="h-[2px] w-[74px] overflow-hidden rounded-full bg-tint/[.07]">
              <span
                className={cn(
                  'block h-full transition-[width] duration-[420ms] ease-out',
                  state.failed
                    ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,.6)]'
                    : 'bg-accent shadow-[0_0_8px_rgba(0,207,255,.6)]',
                )}
                style={{ width: state.entered ? '100%' : '0%' }}
              />
            </span>

            <span className={cn('mono w-[46px] text-right text-[11px]', state.failed ? 'text-danger' : 'text-t3')}>
              {state.done ? `${state.durationMs}ms` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Lê o sinalizador de depuração do `sessionStorage`.
 *
 * Devolve um conjunto com os índices que devem falhar. Vazio em
 * utilização normal — o arranque corre sempre sem erro. A chave é
 * `BOOT_DEBUG_FAIL_KEY`, definida em `boot-steps.ts`.
 */
function readDebugFailFlag(): ReadonlySet<number> {
  try {
    const raw = sessionStorage.getItem(BOOT_DEBUG_FAIL_KEY);
    if (raw === null || raw === '') return new Set();

    if (raw === 'todas') {
      return new Set(BOOT_STEPS.map((_, i) => i));
    }

    const index = Number(raw);
    if (Number.isInteger(index) && index >= 0 && index < BOOT_STEPS.length) {
      return new Set([index]);
    }

    return new Set();
  } catch {
    return new Set();
  }
}
