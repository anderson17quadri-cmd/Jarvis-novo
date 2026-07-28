import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { parseHexColor } from '@/components/shell/wallpaper-field';
import { getDevicePixelRatio, useAnimationFrame } from '@/hooks/use-animation-frame';
import { useReducedMotion } from '@/hooks/use-media-query';
import { cn } from '@/lib/cn';
import { themeService } from '@/services/theme-service';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { useThemeStore } from '@/stores/use-theme-store';
import type { AssistantMode } from '@/types/assistant';
import { CORE_MODES } from './ai-core-modes';
import { pickCoreSize } from './core-size';
import { CoreRings } from './CoreRings';
import { CoreWaveform } from './CoreWaveform';
import { ParticleField, pickParticleCount } from './particle-field';

interface AICoreProps {
  readonly mode: AssistantMode;
  /** Contador de pulsos — incrementá-lo dispara uma onda a partir do centro. */
  readonly pulseCount: number;
  /** Contador de explosões — incrementá-lo dispara a celebração do sucesso. */
  readonly burstCount: number;
  /** `true` depois da entrada em cascata do desktop. */
  readonly isVisible: boolean;
  /** `true` quando o estado abaixo do núcleo já entrou. */
  readonly isStateVisible: boolean;
  /** Encolhe o núcleo quando há janelas abertas, para não competir com elas. */
  readonly isShrunk: boolean;
  readonly onActivate: () => void;
  /**
   * `false` durante a sequência de arranque, onde o núcleo é apresentação e não
   * um controlo: não recebe foco, não tem cursor de mão e não é anunciado como
   * botão pelo leitor de ecrã.
   */
  readonly isInteractive?: boolean;
}

/**
 * AI Core.
 *
 * Três camadas independentes: partículas e radar em canvas, anéis em SVG e a
 * waveform em DOM. Cada uma anima-se sozinha e todas param quando a janela vai
 * para segundo plano.
 *
 * O componente não sabe nada sobre voz nem sobre a IA — recebe um `mode` e
 * desenha-o. Quem decide o modo é o `useVoice` e o `AIService`.
 */
export function AICore({
  mode,
  pulseCount,
  burstCount,
  isVisible,
  isStateVisible,
  isShrunk,
  onActivate,
  isInteractive = true,
}: AICoreProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef(new ParticleField());
  const lastFrameRef = useRef(0);
  const [size, setSize] = useState(() => pickCoreSize(window.innerWidth));

  const theme = useThemeStore((state) => state.theme);
  const reducedMotion = useReducedMotion();
  // Estados do sistema (Parte 9): Economia e Foco aliviam o núcleo.
  const particleScale = useSystemStateStore((state) => state.definition.particleScale);
  const config = CORE_MODES[mode];

  // O canvas precisa da cor resolvida: `var(--accent)` não lhe diz nada.
  // Os modos com cor fixa (analisar, responder, falha) ignoram o tema de
  // propósito, para se lerem à mesma no Solar ou no Titanium.
  const modeColor = useMemo(
    () => config.color ?? themeService.readAccentColor(),
    // `theme` parece não ser usado, mas é: `readAccentColor` lê o CSS computado
    // do `<html>`, que muda quando o tema muda. Sem esta dependência, o núcleo
    // ficava com a cor do tema anterior até o modo mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.color, theme],
  );
  const rgbColor = useMemo(() => parseHexColor(modeColor), [modeColor]);

  const resize = useCallback((): void => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = getDevicePixelRatio();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    fieldRef.current.resize(
      canvas.width,
      canvas.height,
      dpr,
      pickParticleCount(window.innerWidth, reducedMotion, particleScale),
    );
  }, [particleScale, reducedMotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [resize]);

  // Cada incremento de `pulseCount` é um clique no núcleo.
  useEffect(() => {
    if (pulseCount > 0) fieldRef.current.addRipple();
  }, [pulseCount]);

  // E cada incremento de `burstCount` é uma tarefa concluída.
  useEffect(() => {
    if (burstCount > 0) fieldRef.current.burst();
  }, [burstCount]);

  // O núcleo muda de escalão quando a janela muda de tamanho.
  useEffect(() => {
    const onResize = (): void => setSize(pickCoreSize(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useAnimationFrame(
    useCallback(
      (elapsed: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        // Normalizar por 60 FPS: num ecrã de 120 Hz o núcleo rodaria ao dobro.
        const delta = lastFrameRef.current === 0 ? 1 : (elapsed - lastFrameRef.current) / 16.7;
        lastFrameRef.current = elapsed;

        fieldRef.current.draw(ctx, config, rgbColor, Math.min(delta, 3));
      },
      [config, rgbColor],
    ),
  );

  return (
    <>
      <div
        ref={hostRef}
        {...(isInteractive
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': 'Ativar assistente por voz',
              onClick: onActivate,
              onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onActivate();
                }
              },
            }
          : { 'aria-hidden': true })}
        style={{ width: size, height: size }}
        className={cn(
          'ai-core-host relative max-h-[78vmin] max-w-[78vmin]',
          isInteractive && 'cursor-pointer',
          'transition-[transform,opacity] duration-[600ms] ease-out',
          isVisible ? 'opacity-100' : 'opacity-0',
          !isVisible && 'scale-[.86]',
          // Reduz para 75% com janelas abertas, mas nunca desaparece (Parte 8).
          isVisible && (isShrunk ? 'scale-75' : 'scale-100'),
        )}
      >
        {/*
          O centro fica só com a luz.

          O protótipo tinha aqui a palavra "JARVIS", mas por decisão do
          utilizador o núcleo não leva texto: a identidade já está no header, e
          o centro lê-se melhor sem uma legenda a competir com o brilho.
        */}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <CoreRings mode={mode} />
      </div>

      <div
        className={cn(
          'mt-s3 flex flex-col items-center gap-3 transition-opacity duration-[500ms] ease-out',
          isStateVisible ? 'opacity-100 delay-200' : 'opacity-0',
        )}
      >
        {/* `aria-live` anuncia a mudança de estado a quem usa leitor de ecrã. */}
        <div
          className="flex items-center gap-[9px] text-label uppercase transition-colors duration-300"
          style={{ color: modeColor }}
          aria-live="polite"
        >
          <span
            className="h-[6px] w-[6px] rounded-full bg-current shadow-[0_0_10px_currentColor] motion-safe:animate-breathe"
            aria-hidden="true"
          />
          <span>{config.label}</span>
        </div>

        <CoreWaveform mode={mode} color={modeColor} />
      </div>
    </>
  );
}
