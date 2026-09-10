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

  // Ajuste durante o render, não num efeito: esconder, mostrar tudo de uma
  // vez (movimento reduzido) e recomeçar a cascata são consequências diretas
  // das props. O estado interno serve só para a cascata com temporizadores.
  const [anterior, setAnterior] = useState({ isActive, reducedMotion });
  if (anterior.isActive !== isActive || anterior.reducedMotion !== reducedMotion) {
    setAnterior({ isActive, reducedMotion });
    if (!isActive) setVisible(allStages(false));
    else if (reducedMotion) setVisible(allStages(true));
    else if (anterior.isActive && anterior.reducedMotion) setVisible(allStages(true));
    else setVisible(allStages(false));
  }

  useEffect(() => {
    if (!isActive || reducedMotion) return;

    const timers = Object.entries(CASCADE_DELAYS).map(([stage, delay]) =>
      setTimeout(() => {
        setVisible((previous) => ({ ...previous, [stage as CascadeStage]: true }));
      }, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [isActive, reducedMotion]);

  if (!isActive) return allStages(false);
  if (reducedMotion) return allStages(true);
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
