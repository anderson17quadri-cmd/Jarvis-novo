import { useCallback, useEffect, useRef } from 'react';

import { useAnimationFrame } from '@/hooks/use-animation-frame';
import { useIsCoarsePointer } from '@/hooks/use-media-query';
import { CORE_MODES } from './ai-core-modes';
import type { AssistantMode } from '@/types/assistant';

/**
 * Anéis do núcleo, em SVG.
 *
 * Cada anel roda a uma velocidade própria e em sentidos alternados — é isso que
 * faz o conjunto parecer maquinaria em vez de um só disco a girar. O terceiro
 * anel leva ainda uma oscilação, para o movimento nunca ficar previsível.
 *
 * Em SVG e não em canvas porque os traços são geometria fixa: assim escalam
 * sem perder nitidez. A cor vem de `color` (Parte 15 §Núcleo personalizável)
 * em vez de `var(--accent)` fixo, para a preferência de cor do núcleo se
 * aplicar aqui também, e não só às partículas do canvas.
 */

/** Velocidade angular de cada anel, em graus por milissegundo. */
const RING_SPEEDS = [0.0018, 0.003, -0.007, 0.011, -0.016] as const;

interface CoreRingsProps {
  readonly mode: AssistantMode;
  /** A cor já resolvida do núcleo — ver `AICore.modeColor`. */
  readonly color: string;
  /**
   * Entre 0.5 e 2 (Parte 15 §Núcleo personalizável). Multiplica a velocidade
   * de rotação de todos os anéis — `1` é a velocidade de sempre.
   */
  readonly speedScale?: number;
  /**
   * Falso esconde os anéis, deixando só o brilho central (Parte 15 §Núcleo
   * personalizável — a opção que ficava por decidir). As partículas orbitais
   * vivem à parte, num canvas próprio em `AICore.tsx`, e continuam a
   * aparecer normalmente: isto só tira os anéis em SVG.
   */
  readonly ringsVisible?: boolean;
}

export function CoreRings({ mode, color, speedScale = 1, ringsVisible = true }: CoreRingsProps): React.JSX.Element {
  // Uma ref por anel, em vez de uma fábrica de callbacks de ref criada a cada
  // render — o callback criado no render conta como acesso a refs durante o
  // render para o compilador, e a ref direta não.
  const ring0Ref = useRef<SVGGElement>(null);
  const ring1Ref = useRef<SVGGElement>(null);
  const ring2Ref = useRef<SVGGElement>(null);
  const ring3Ref = useRef<SVGGElement>(null);
  const ring4Ref = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tiltRef = useRef({ x: 0, y: 0 });

  useCursorTilt(tiltRef);

  const config = CORE_MODES[mode];

  useAnimationFrame(
    useCallback(
      (elapsed: number) => {
        // O tipo amarra esta lista ao `RING_SPEEDS`: é um tipo mapeado sobre
        // o tuplo, por isso tem forçosamente o mesmo comprimento. Sem isto,
        // acrescentar uma sexta velocidade dava um anel que nunca anima — sem
        // erro de compilação e sem teste a falhar, porque `rings[5]` seria só
        // `undefined` e o `continue` engolia-o em silêncio.
        const rings: readonly React.RefObject<SVGGElement | null>[] & {
          readonly length: (typeof RING_SPEEDS)['length'];
        } = [ring0Ref, ring1Ref, ring2Ref, ring3Ref, ring4Ref];
        for (const [index, speed] of RING_SPEEDS.entries()) {
          const ring = rings[index]?.current;
          if (!ring) continue;

          // O quarto anel (índice 3) oscila além de rodar.
          const wobble = index === 3 ? Math.sin(elapsed / 900) * 2.5 : 0;
          ring.style.transform = `rotate(${elapsed * speed * config.spin * speedScale + wobble}deg)`;
        }

        // Respiração: 100% → 103% em ciclos de 5s, mais a inclinação do cursor.
        const breath = 1 + Math.sin(elapsed / 2_500) * 0.015;
        const { x, y } = tiltRef.current;
        if (svgRef.current) {
          svgRef.current.style.transform = `perspective(900px) rotateX(${y.toFixed(2)}deg) rotateY(${x.toFixed(2)}deg) scale(${breath.toFixed(4)})`;
        }

        // Pulsação do núcleo energético, mais forte fora do repouso.
        if (glowRef.current) {
          const radius = 56 * (1 + Math.sin(elapsed / 700) * config.glowPulse);
          glowRef.current.setAttribute('r', radius.toFixed(1));
        }
      },
      [config.glowPulse, config.spin, speedScale],
    ),
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 400"
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="core-glow-gradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="26%" stopColor="#a9efff" />
          <stop offset="58%" stopColor={color} />
          <stop offset="100%" stopColor="rgba(0,162,255,0)" />
        </radialGradient>
        <filter id="core-bloom">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="core-soft">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {ringsVisible && (
        <>
          {/* Halo exterior */}
          <g ref={ring0Ref} style={{ transformOrigin: '200px 200px' }}>
            <circle
              cx="200"
              cy="200"
              r="192"
              fill="none"
              stroke="rgba(0,207,255,.08)"
              strokeWidth="16"
              filter="url(#core-soft)"
            />
          </g>

          {/* Anel principal, com marcas técnicas */}
          <g ref={ring1Ref} style={{ transformOrigin: '200px 200px' }}>
            <circle cx="200" cy="200" r="176" fill="none" stroke={color} strokeWidth="1" opacity=".3" />
            <circle
              cx="200"
              cy="200"
              r="168"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray="1.4 10"
              strokeLinecap="round"
              opacity=".55"
            />
            <circle
              cx="200"
              cy="200"
              r="152"
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeDasharray="62 30"
              opacity=".14"
            />
          </g>

          {/* Anel secundário, sentido inverso */}
          <g ref={ring2Ref} style={{ transformOrigin: '200px 200px' }}>
            <circle
              cx="200"
              cy="200"
              r="136"
              fill="none"
              stroke="var(--neon)"
              strokeWidth="2"
              strokeDasharray="3 7"
              opacity=".6"
            />
            <circle
              cx="200"
              cy="200"
              r="126"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeDasharray="34 84"
              strokeLinecap="round"
              opacity=".22"
            />
          </g>

          {/* Anel interno irregular */}
          <g ref={ring3Ref} style={{ transformOrigin: '200px 200px' }}>
            <circle
              cx="200"
              cy="200"
              r="106"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeDasharray="1 5"
              opacity=".42"
            />
            <circle cx="200" cy="200" r="92" fill="none" stroke={color} strokeWidth="1" opacity=".3" />
          </g>

          <g ref={ring4Ref} style={{ transformOrigin: '200px 200px' }}>
            <circle
              cx="200"
              cy="200"
              r="76"
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeDasharray="26 20"
              opacity=".3"
            />
          </g>

          {/* Cruzetas — fixas, dão referencial ao movimento dos anéis */}
          <g stroke={color} strokeWidth="1.6" opacity=".5" strokeLinecap="round">
            <path d="M200 4v22M200 374v22M4 200h22M374 200h22" />
          </g>
          <g stroke="rgba(0,207,255,.16)" strokeWidth="1">
            <path d="M200 44v312M44 200h312" />
          </g>
        </>
      )}

      {/* Núcleo energético */}
      <circle
        ref={glowRef}
        cx="200"
        cy="200"
        r="56"
        fill="url(#core-glow-gradient)"
        filter="url(#core-bloom)"
      />
      <circle cx="200" cy="200" r="17" fill="#f2feff" opacity=".95" />
    </svg>
  );
}

/** Inclinação máxima do núcleo segundo o cursor, em graus. */
const MAX_TILT_DEG = 6;

/**
 * Inclina o núcleo consoante a posição do cursor.
 *
 * Escreve numa ref em vez de estado: um `setState` por movimento do rato
 * re-renderizaria a árvore 60 vezes por segundo. O loop de animação lê a ref no
 * frame seguinte, que é onde a inclinação é aplicada.
 *
 * Em ecrãs de toque não há ponteiro para seguir — o listener nem se regista.
 */
function useCursorTilt(tiltRef: React.RefObject<{ x: number; y: number }>): void {
  const isCoarsePointer = useIsCoarsePointer();

  useEffect(() => {
    if (isCoarsePointer) return;

    const onPointerMove = (event: PointerEvent): void => {
      const x = (event.clientX / window.innerWidth - 0.5) * MAX_TILT_DEG * 2;
      const y = -(event.clientY / window.innerHeight - 0.5) * MAX_TILT_DEG * 2;

      tiltRef.current.x = clamp(x, -MAX_TILT_DEG, MAX_TILT_DEG);
      tiltRef.current.y = clamp(y, -MAX_TILT_DEG, MAX_TILT_DEG);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [isCoarsePointer, tiltRef]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
