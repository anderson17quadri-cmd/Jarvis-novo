import { cn } from '@/lib/cn';

/**
 * Indicador de carregamento do sistema.
 *
 * A Parte 2 §Loading proíbe o spinner comum e pede anéis, radar ou scanner.
 * São três anéis concêntricos a rodar em sentidos alternados, com um traçado
 * parcial — a mesma linguagem do AI Core, em miniatura.
 *
 * Animado só por CSS: um `requestAnimationFrame` para um estado transitório
 * de carregamento seria custo sem retorno. A regra global de
 * `prefers-reduced-motion` já o imobiliza sem código extra aqui.
 */

interface CoreLoaderProps {
  /** Diâmetro em pixels. */
  readonly size?: number;
  /** Texto anunciado a leitores de ecrã e mostrado por baixo. */
  readonly label?: string;
  readonly className?: string;
}

export function CoreLoader({
  size = 44,
  label = 'A carregar',
  className,
}: CoreLoaderProps): React.JSX.Element {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Exterior, lento e no sentido horário. */}
        <circle
          className="core-loader-ring core-loader-ring--outer"
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="26 106"
          strokeLinecap="round"
          opacity=".85"
        />
        {/* Intermédio, inverso e mais rápido. */}
        <circle
          className="core-loader-ring core-loader-ring--middle"
          cx="24"
          cy="24"
          r="14"
          fill="none"
          stroke="var(--neon)"
          strokeWidth="2.5"
          strokeDasharray="14 74"
          strokeLinecap="round"
          opacity=".6"
        />
        {/* Interior, tracejado fino. */}
        <circle
          className="core-loader-ring core-loader-ring--inner"
          cx="24"
          cy="24"
          r="8"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeDasharray="1 5"
          opacity=".4"
        />
        {/* Núcleo, a respirar. */}
        <circle className="core-loader-core" cx="24" cy="24" r="3" fill="var(--accent)" />
      </svg>

      {label.length > 0 && <span className="text-cap text-t3">{label}</span>}
    </div>
  );
}
