import { useCallback, useEffect, useRef } from 'react';

import { getDevicePixelRatio, useAnimationFrame } from '@/hooks/use-animation-frame';
import { useIsCoarsePointer, useReducedMotion } from '@/hooks/use-media-query';
import { themeService } from '@/services/theme-service';
import { useThemeStore } from '@/stores/use-theme-store';
import { parseHexColor, WallpaperField, type RGB } from './wallpaper-field';

/** Amplitude do parallax da grelha, em pixels. */
const PARALLAX_RANGE = 14;

/**
 * Wallpaper procedural — seis camadas empilhadas.
 *
 * 1. nebulosa (CSS, gradientes desfocados à deriva)
 * 2. grelha com parallax segundo o cursor
 * 3. partículas ligadas (canvas)
 * 4. linhas holográficas (canvas)
 * 5. ruído
 * 6. vinheta
 *
 * As camadas 3 e 4 param sozinhas quando a janela vai para segundo plano ou
 * quando o utilizador pediu menos movimento.
 */
export function Wallpaper(): React.JSX.Element {
  const particleRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef(new WallpaperField());
  const accentRef = useRef<RGB>({ r: 0, g: 207, b: 255 });

  const theme = useThemeStore((state) => state.theme);
  const reducedMotion = useReducedMotion();
  const isCoarsePointer = useIsCoarsePointer();

  // O canvas não resolve `var(--accent)`: a cor tem de vir já calculada, e é
  // relida sempre que o tema muda.
  useEffect(() => {
    accentRef.current = parseHexColor(themeService.readAccentColor());
  }, [theme]);

  const resize = useCallback((): void => {
    const particleCanvas = particleRef.current;
    const lineCanvas = lineRef.current;
    if (!particleCanvas || !lineCanvas) return;

    const dpr = getDevicePixelRatio();
    const width = window.innerWidth * dpr;
    const height = window.innerHeight * dpr;

    for (const canvas of [particleCanvas, lineCanvas]) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }

    fieldRef.current.resize(width, height, dpr, reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  useAnimationFrame(
    useCallback(() => {
      const particleCtx = particleRef.current?.getContext('2d');
      const lineCtx = lineRef.current?.getContext('2d');
      if (!particleCtx || !lineCtx) return;

      fieldRef.current.draw(particleCtx, lineCtx, accentRef.current);
    }, []),
    !reducedMotion,
  );

  // Parallax só faz sentido com rato. Em ecrãs de toque nem se regista o listener.
  useEffect(() => {
    if (isCoarsePointer || reducedMotion) return;

    const onPointerMove = (event: PointerEvent): void => {
      const grid = gridRef.current;
      if (!grid) return;

      const dx = (event.clientX / window.innerWidth - 0.5) * PARALLAX_RANGE;
      const dy = (event.clientY / window.innerHeight - 0.5) * PARALLAX_RANGE;
      // Só `transform` — nunca `left`/`top`, que forçariam layout.
      grid.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [isCoarsePointer, reducedMotion]);

  return (
    <div aria-hidden="true">
      {/* Cada camada leva `wp-layer` e um nome próprio: é por esses nomes que
          `appearance.css` liga e desliga as variantes do papel de parede. */}
      <div className="layer wp-layer wp-nebula z-wallpaper">
        <i className="wp-nebula-1" />
        <i className="wp-nebula-2" />
        <i className="wp-nebula-3" />
      </div>

      <div ref={gridRef} className="layer wp-layer wp-grid" style={{ zIndex: 1 }} />

      <canvas ref={particleRef} className="layer wp-layer wp-particles" style={{ zIndex: 2 }} />
      <canvas
        ref={lineRef}
        className="layer wp-layer wp-lines opacity-50"
        style={{ zIndex: 3 }}
      />

      <div className="layer wp-noise" style={{ zIndex: 4 }} />
      <div className="layer wp-vignette" style={{ zIndex: 5 }} />
    </div>
  );
}
