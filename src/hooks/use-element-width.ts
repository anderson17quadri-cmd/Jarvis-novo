import { useEffect, useState, type RefObject } from 'react';

/**
 * Largura de um elemento, acompanhada enquanto muda.
 *
 * Existe porque dentro de uma janela o ponto de quebra do ecrã não serve de
 * nada: uma janela de 400px num monitor de 27" é apertada na mesma. Quem vive
 * dentro de uma janela decide o seu layout pela largura que tem, não pela do
 * ecrã.
 *
 * Devolve `0` até à primeira medição — quem chama trata isso como "ainda não
 * sei", e não como "não tem largura nenhuma".
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
