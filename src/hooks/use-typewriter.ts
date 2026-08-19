import { useEffect, useState } from 'react';

import { useReducedMotion } from './use-media-query';

interface TypewriterOptions {
  readonly speedMs: number;
  /** Variação aleatória por carácter — sem ela o ritmo soa mecânico. */
  readonly jitterMs?: number;
  readonly onComplete?: () => void;
  readonly enabled?: boolean;
}

/**
 * Escreve texto carácter a carácter.
 *
 * Com `prefers-reduced-motion` o texto aparece de uma vez e a callback dispara
 * logo — quem pediu menos movimento não deve ficar à espera da animação.
 */
export function useTypewriter(
  text: string,
  { speedMs, jitterMs = 26, onComplete, enabled = true }: TypewriterOptions,
): { readonly typed: string; readonly isComplete: boolean } {
  const [typed, setTyped] = useState('');
  const [isComplete, setComplete] = useState(false);
  const reducedMotion = useReducedMotion();
  const aEscrever = enabled && !reducedMotion;

  // Reinício durante o render, não num efeito: quando o texto muda ou a
  // escrita (re)começa, o estado acompanha logo, sem um render intermédio
  // com o texto antigo.
  const [anterior, setAnterior] = useState({ text, aEscrever });
  if (anterior.text !== text || anterior.aEscrever !== aEscrever) {
    setAnterior({ text, aEscrever });
    setTyped('');
    setComplete(false);
  }

  useEffect(() => {
    if (!enabled) return;

    // A callback dispara no efeito: é um acontecimento, não estado.
    if (reducedMotion) {
      onComplete?.();
      return;
    }

    let index = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = (): void => {
      index += 1;
      setTyped(text.slice(0, index));

      if (index < text.length) {
        timer = setTimeout(step, speedMs + Math.random() * jitterMs);
      } else {
        setComplete(true);
        onComplete?.();
      }
    };

    timer = setTimeout(step, speedMs);
    return () => clearTimeout(timer);
    // `onComplete` fica de fora de propósito: quem chama costuma passar uma
    // função nova a cada render, e isso reiniciaria a escrita sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speedMs, jitterMs, enabled, reducedMotion]);

  if (!enabled) return { typed: '', isComplete: false };
  if (reducedMotion) return { typed: text, isComplete: true };
  return { typed, isComplete };
}
