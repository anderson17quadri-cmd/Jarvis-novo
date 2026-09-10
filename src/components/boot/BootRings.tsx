import { useCallback, useRef } from 'react';

import { useAnimationFrame } from '@/hooks/use-animation-frame';

/**
 * Etapa 2 do arranque — o ponto transforma-se em anéis (Parte 4 §2).
 *
 * Oito anéis, cada um com raio, espessura, tracejado, opacidade e velocidade
 * próprios, em sentidos alternados. Nenhum é igual a outro: é essa
 * irregularidade que faz o conjunto parecer maquinaria e não um alvo.
 */

interface RingSpec {
  readonly radius: number;
  readonly width: number;
  readonly dash: string;
  readonly opacity: number;
  /** Graus por milissegundo. Negativo inverte o sentido. */
  readonly speed: number;
}

const RINGS: readonly RingSpec[] = [
  { radius: 150, width: 1, dash: '', opacity: 0.18, speed: 0.002 },
  { radius: 134, width: 10, dash: '2 14', opacity: 0.5, speed: -0.004 },
  { radius: 118, width: 3, dash: '40 22', opacity: 0.28, speed: 0.007 },
  { radius: 100, width: 14, dash: '1 7', opacity: 0.34, speed: -0.011 },
  { radius: 84, width: 2, dash: '6 10', opacity: 0.55, speed: 0.016 },
  { radius: 66, width: 8, dash: '30 60', opacity: 0.24, speed: -0.021 },
  { radius: 48, width: 1.5, dash: '', opacity: 0.4, speed: 0.028 },
  { radius: 32, width: 6, dash: '3 9', opacity: 0.45, speed: -0.036 },
];

const VIEWBOX = 340;
const CENTER = VIEWBOX / 2;

export function BootRings(): React.JSX.Element {
  const groupRefs = useRef<(SVGGElement | null)[]>([]);

  useAnimationFrame(
    useCallback((elapsed: number) => {
      for (const [index, ring] of RINGS.entries()) {
        const group = groupRefs.current[index];
        if (!group) continue;
        group.style.transform = `rotate(${elapsed * ring.speed}deg)`;
      }
    }, []),
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className="h-[min(340px,72vmin)] w-[min(340px,72vmin)] overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="boot-core-gradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#a9efff" />
          <stop offset="100%" stopColor="rgba(0,162,255,0)" />
        </radialGradient>
        <filter id="boot-bloom">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {RINGS.map((ring, index) => (
        <g
          key={ring.radius}
          ref={(element) => {
            groupRefs.current[index] = element;
          }}
          style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={ring.radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={ring.width}
            strokeDasharray={ring.dash || undefined}
            strokeLinecap="round"
            opacity={ring.opacity}
          />
        </g>
      ))}

      {/* Cruzetas — dão referencial fixo ao movimento dos anéis. */}
      <g stroke="var(--accent)" strokeWidth="1.4" opacity=".45" strokeLinecap="round">
        <path
          d={`M${CENTER} 8v18M${CENTER} ${VIEWBOX - 26}v18M8 ${CENTER}h18M${VIEWBOX - 26} ${CENTER}h18`}
        />
      </g>

      <circle
        cx={CENTER}
        cy={CENTER}
        r="22"
        fill="url(#boot-core-gradient)"
        filter="url(#boot-bloom)"
      />
    </svg>
  );
}
