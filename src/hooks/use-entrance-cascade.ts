import { useEffect, useState } from 'react';

import { useReducedMotion } from './use-media-query';

/** Atrasos da entrada em cascata, em milissegundos (Parte 5 §Transição). */
export const CASCADE_DELAYS = {
  header: 80,
  rail: 200,
  core: 320,
  coreState: 520,
  dock: 640,
} as const;

export type CascadeStage = keyof typeof CASCADE_DELAYS;

/**
 * Entrada em cascata do desktop: header, rail, núcleo, estado, dock.
 *
 * Com `prefers-reduced-motion` tudo entra de uma vez — a cascata é decoração, e
 * decoração é a primeira coisa a desaparecer quando o utilizador pede sossego.
 */
export function useEntranceCascade(isActive: boolean): Record<CascadeStage, boolean> {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState<Record<CascadeStage, boolean>>(() => allStages(false));

  useEffect(() => {
    if (!isActive) {
      setVisible(allStages(false));
      return;
    }

    if (reducedMotion) {
      setVisible(allStages(true));
      return;
    }

    const timers = Object.entries(CASCADE_DELAYS).map(([stage, delay]) =>
      setTimeout(() => {
        setVisible((previous) => ({ ...previous, [stage as CascadeStage]: true }));
      }, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [isActive, reducedMotion]);

  return visible;
}

function allStages(value: boolean): Record<CascadeStage, boolean> {
  return {
    header: value,
    rail: value,
    core: value,
    coreState: value,
    dock: value,
  };
}
