import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useReducedMotion } from '@/hooks/use-media-query';
import { useTypewriter } from '@/hooks/use-typewriter';
import { cn } from '@/lib/cn';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { BootChecks } from './BootChecks';
import { BOOT_GRAPHS, BOOT_TIMING, BOOT_TYPE_LINE, type BootStage } from './boot-steps';

interface BootSequenceProps {
  readonly onComplete: () => void;
}

/**
 * Sequência de arranque, em cinco etapas.
 *
 * 1. faísca com ondas concêntricas
 * 2. linha escrita carácter a carácter
 * 3. as 10 verificações do sistema
 * 4. cartões de métricas
 * 5. identidade do sistema
 *
 * Na segunda vez salta direto para a etapa 5 — ver o arranque completo uma vez
 * é uma apresentação, vê-lo todos os dias é um obstáculo. A flag fica guardada
 * pelo `StorageService`, ou seja no `store` do Tauri no desktop e no Android.
 */
export function BootSequence({ onComplete }: BootSequenceProps): React.JSX.Element {
  const [stage, setStage] = useState<BootStage | null>(null);
  const [isLeaving, setLeaving] = useState(false);
  const reducedMotion = useReducedMotion();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasFinishedRef = useRef(false);

  const wait = useCallback((callback: () => void, ms: number): void => {
    timersRef.current.push(setTimeout(callback, ms));
  }, []);

  /** Encerra a sequência. Idempotente: o botão de saltar pode chegar a meio. */
  const finish = useCallback((): void => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setLeaving(true);
    void storageService.set(STORAGE_KEYS.booted, true);

    setTimeout(onComplete, reducedMotion ? 0 : BOOT_TIMING.exitDuration);
  }, [onComplete, reducedMotion]);

  // Decide entre arranque completo e arranque rápido.
  useEffect(() => {
    let cancelled = false;

    void storageService.get<boolean>(STORAGE_KEYS.booted, false).then((hasBooted) => {
      if (cancelled) return;

      if (hasBooted || reducedMotion) {
        setStage(5);
        wait(finish, reducedMotion ? 0 : BOOT_TIMING.fastBootDuration);
        return;
      }

      setStage(1);
      wait(() => setStage(2), BOOT_TIMING.sparkDuration);
    });

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
    };
  }, [finish, reducedMotion, wait]);

  const handleTypeComplete = useCallback((): void => {
    wait(() => setStage(3), BOOT_TIMING.typePause);
  }, [wait]);

  const handleChecksComplete = useCallback((): void => {
    setStage(4);
    wait(() => {
      setStage(5);
      wait(finish, BOOT_TIMING.identityDuration);
    }, BOOT_TIMING.graphsDuration);
  }, [finish, wait]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-boot flex items-center justify-center bg-bg p-s3',
          'transition-[opacity,visibility] duration-[800ms] ease-io',
          isLeaving && 'invisible opacity-0',
        )}
        role="status"
        aria-label="A iniciar o sistema"
      >
        {stage === 1 && <BootSpark />}
        {stage === 2 && <BootTypeLine onComplete={handleTypeComplete} />}
        {stage === 3 && <BootChecks onComplete={handleChecksComplete} />}
        {stage === 4 && <BootGraphs />}
        {stage === 5 && <BootIdentity />}
      </div>

      {!isLeaving && stage !== null && stage < 5 && (
        <button
          type="button"
          onClick={finish}
          className={cn(
            'fixed bottom-[26px] right-[26px] z-[601] rounded-btn border border-line px-4 py-[9px]',
            'bg-[rgb(11_17_24_/_0.6)] text-cap text-t3 backdrop-blur-soft',
            'transition-all duration-hover ease-out hover:border-accent/35 hover:text-accent',
          )}
        >
          Saltar sequência
        </button>
      )}

      {/* Scanline de transição: uma linha que varre o ecrã de cima a baixo. */}
      {isLeaving && !reducedMotion && <div className="boot-scanline" aria-hidden="true" />}
    </>
  );
}

function BootSpark(): React.JSX.Element {
  return (
    <div className="relative flex items-center justify-center" aria-hidden="true">
      <span className="boot-ripple" />
      <span className="boot-ripple" style={{ animationDelay: '0.8s' }} />
      <span className="boot-spark" />
    </div>
  );
}

function BootTypeLine({ onComplete }: { readonly onComplete: () => void }): React.JSX.Element {
  const { typed } = useTypewriter(BOOT_TYPE_LINE, {
    speedMs: BOOT_TIMING.typeSpeed,
    onComplete,
  });

  return (
    <p className="min-h-[22px] text-desc tracking-[0.02em] text-t2">
      {typed}
      <span className="ml-[3px] inline-block h-[14px] w-[7px] translate-y-[2px] bg-accent motion-safe:animate-blink" />
    </p>
  );
}

function BootGraphs(): React.JSX.Element {
  // Gerado uma vez: com `useMemo` as linhas não voltam a saltar a cada render.
  const sparklines = useMemo(
    () => BOOT_GRAPHS.map(() => buildSparklinePath()),
    [],
  );

  return (
    <div className="flex w-[min(560px,94vw)] flex-wrap justify-center gap-s2">
      {BOOT_GRAPHS.map((graph, index) => (
        <div
          key={graph.key}
          className="min-w-[96px] flex-1 rounded-card border border-line bg-[rgb(16_25_34_/_0.6)] px-[14px] py-3"
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-t3">{graph.key}</div>
          <div className="mono mt-0.5 text-[19px] font-semibold">{graph.value}</div>
          <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="mt-1.5 h-[26px] w-full overflow-visible">
            <path
              d={sparklines[index] ?? ''}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,207,255,.6))' }}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

function buildSparklinePath(): string {
  return Array.from({ length: 16 }, (_, index) => {
    const value = 8 + Math.random() * 16;
    const x = (index * (100 / 15)).toFixed(1);
    const y = (26 - value).toFixed(1);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
}

function BootIdentity(): React.JSX.Element {
  return (
    <div className="text-center">
      <div
        className={cn(
          'pl-[0.4em] text-[clamp(30px,7vw,54px)] font-light tracking-[0.4em]',
          'bg-gradient-to-r from-accent to-[#a9efff] bg-clip-text text-transparent',
        )}
      >
        JARVIS AI
      </div>
      <div className="mt-2.5 text-[13px] uppercase tracking-[0.24em] text-t3">
        Artificial Intelligence Operating System
      </div>
      <div className="mt-5 text-[11px] tracking-[0.18em] text-t3">VERSÃO 1.0 · PROJECT ARC</div>
    </div>
  );
}
