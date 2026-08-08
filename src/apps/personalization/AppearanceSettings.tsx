import { Check, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import {
  APPEARANCE_RANGES,
  CURSOR_LABELS,
  DALTONISM_DESCRIPTIONS,
  DALTONISM_LABELS,
  FONT_FAMILY_DESCRIPTIONS,
  FONT_FAMILY_LABELS,
  FONT_FAMILY_STACKS,
  RADIUS_LABELS,
  WALLPAPER_DESCRIPTIONS,
  WALLPAPER_LABELS,
  type CursorKind,
  type DaltonismKind,
  type FontFamilyKind,
  type RadiusKind,
  type WallpaperKind,
} from '@/types/appearance';

/**
 * Aparência (Parte 15).
 *
 * Papel de parede, núcleo, densidade da interface, cursor e acessibilidade.
 * Todas as mudanças são imediatas — a spec é explícita: nunca exige
 * reinicialização.
 */
export function AppearanceSettings(): React.JSX.Element {
  const appearance = useAppearanceStore((state) => state.appearance);
  const set = useAppearanceStore((state) => state.set);
  const reset = useAppearanceStore((state) => state.reset);
  const persist = useAppearanceStore((state) => state.persist);

  /** Muda e guarda. Guardar a cada passo de um cursor deslizante seria demais. */
  const change = <K extends keyof typeof appearance>(
    key: K,
    value: (typeof appearance)[K],
    save = true,
  ): void => {
    set(key, value);
    if (save) void persist();
  };

  return (
    <div className="flex flex-col gap-s3">
      <section>
        <p className="t-label mb-2">Papel de parede</p>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
          role="radiogroup"
          aria-label="Papel de parede"
        >
          {(Object.keys(WALLPAPER_LABELS) as WallpaperKind[]).map((kind) => (
            <Option
              key={kind}
              isActive={appearance.wallpaper === kind}
              onClick={() => change('wallpaper', kind)}
              title={WALLPAPER_LABELS[kind]}
              description={WALLPAPER_DESCRIPTIONS[kind]}
            />
          ))}
        </div>

        <Slider
          label="Intensidade"
          value={appearance.wallpaperIntensity}
          range={APPEARANCE_RANGES.wallpaperIntensity}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => change('wallpaperIntensity', value, false)}
          onCommit={() => void persist()}
          isDisabled={appearance.wallpaper === 'liso'}
        />
      </section>

      <section className="border-t border-line pt-s3">
        <p className="t-label mb-2">Núcleo</p>
        <Slider
          label="Partículas"
          value={appearance.coreParticles}
          range={APPEARANCE_RANGES.coreParticles}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => change('coreParticles', value, false)}
          onCommit={() => void persist()}
        />
        <p className="mt-1.5 text-cap text-t3">
          O estado do sistema também mexe nisto — os dois multiplicam-se, e o núcleo nunca
          fica sem partícula nenhuma.
        </p>
      </section>

      <section className="border-t border-line pt-s3">
        <p className="t-label mb-2">Interface</p>

        <Slider
          label="Escala"
          value={appearance.uiScale}
          range={APPEARANCE_RANGES.uiScale}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => change('uiScale', value, false)}
          onCommit={() => void persist()}
        />

        <p className="mt-3 mb-1.5 text-[11.5px] text-t3">Arredondamento</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Arredondamento">
          {(Object.keys(RADIUS_LABELS) as RadiusKind[]).map((kind) => (
            <Chip
              key={kind}
              isActive={appearance.radius === kind}
              onClick={() => change('radius', kind)}
            >
              {RADIUS_LABELS[kind]}
            </Chip>
          ))}
        </div>

        <p className="mt-3 mb-1.5 text-[11.5px] text-t3">Cursor</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cursor">
          {(Object.keys(CURSOR_LABELS) as CursorKind[]).map((kind) => (
            <Chip
              key={kind}
              isActive={appearance.cursor === kind}
              onClick={() => change('cursor', kind)}
            >
              {CURSOR_LABELS[kind]}
            </Chip>
          ))}
        </div>
      </section>

      <section className="border-t border-line pt-s3">
        <p className="t-label mb-2">Tipografia</p>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
          role="radiogroup"
          aria-label="Família tipográfica"
        >
          {(Object.keys(FONT_FAMILY_LABELS) as FontFamilyKind[]).map((kind) => (
            <Option
              key={kind}
              isActive={appearance.fontFamily === kind}
              onClick={() => change('fontFamily', kind)}
              title={FONT_FAMILY_LABELS[kind]}
              // A própria opção mostra-se na fonte que representa — a escolha
              // vê-se antes de se fazer, e não só depois.
              titleStyle={{ fontFamily: FONT_FAMILY_STACKS[kind] }}
              description={FONT_FAMILY_DESCRIPTIONS[kind]}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-line pt-s3">
        <p className="t-label mb-2">Acessibilidade</p>

        <div className="flex flex-col gap-2">
          <Toggle
            isOn={appearance.highContrast}
            onClick={() => change('highContrast', !appearance.highContrast)}
            title="Alto contraste"
            description="Texto secundário mais claro, linhas mais visíveis, fundo mais discreto."
          />
          <Toggle
            isOn={appearance.reduceTransparency}
            onClick={() => change('reduceTransparency', !appearance.reduceTransparency)}
            title="Reduzir transparência"
            description="Tira o desfoque das superfícies. Ajuda a ler, e é o maior alívio para máquinas lentas."
          />
        </div>

        <p className="mb-2 mt-3 text-[11.5px] text-t3">
          Correção de daltonismo — aplica-se a tudo, incluindo o núcleo e os gráficos.
        </p>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
          role="radiogroup"
          aria-label="Correção de daltonismo"
        >
          {(Object.keys(DALTONISM_LABELS) as DaltonismKind[]).map((kind) => (
            <Option
              key={kind}
              isActive={appearance.daltonism === kind}
              onClick={() => change('daltonism', kind)}
              title={DALTONISM_LABELS[kind]}
              description={DALTONISM_DESCRIPTIONS[kind]}
            />
          ))}
        </div>

        <p className="mt-2.5 text-cap text-t3">
          A redução de movimento vem da preferência do sistema operativo e já é respeitada —
          não se sobrepõe aqui.
        </p>
      </section>

      <button
        type="button"
        onClick={() => {
          reset();
          void persist();
        }}
        className={cn(
          'flex min-h-[36px] items-center gap-2 self-start rounded-btn border border-line px-3 py-2',
          'text-[12px] text-t2 transition-all duration-hover ease-out',
          'hover:border-accent/35 hover:text-accent active:scale-[.98] compact:min-h-[44px]',
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Repor a aparência
      </button>
    </div>
  );
}

function Option({
  isActive,
  onClick,
  title,
  titleStyle,
  description,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly title: string;
  /** Estilo aplicado só ao título — a pré-visualização da tipografia usa isto. */
  readonly titleStyle?: React.CSSProperties;
  readonly description: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      className={cn(
        'rounded-input border border-line p-2.5 text-left transition-all duration-hover ease-out',
        'hover:border-accent/35 hover:bg-accent/[.04]',
        isActive && 'border-accent bg-accent/[.08]',
      )}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={titleStyle}>
        {title}
        {isActive && <Check className="ml-auto h-3.5 w-3.5 text-accent" aria-hidden="true" />}
      </span>
      <span className="mt-1 block text-[10.5px] leading-[1.45] text-t3">{description}</span>
    </button>
  );
}

function Slider({
  label,
  value,
  range,
  format,
  onChange,
  onCommit,
  isDisabled = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly range: { readonly min: number; readonly max: number; readonly step: number };
  readonly format: (value: number) => string;
  readonly onChange: (value: number) => void;
  readonly onCommit: () => void;
  readonly isDisabled?: boolean;
}): React.JSX.Element {
  return (
    <label className={cn('mt-2.5 flex items-center gap-2.5', isDisabled && 'opacity-40')}>
      <span className="w-[76px] flex-shrink-0 text-[11.5px] text-t3">{label}</span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        disabled={isDisabled}
        onChange={(event) => onChange(Number(event.target.value))}
        // Guardar a cada passo do arrasto escreveria dezenas de vezes por
        // segundo. Guarda-se ao largar.
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="jarvis-range flex-1"
      />
      <span className="mono w-[42px] flex-shrink-0 text-right text-[11px] text-t3">
        {format(value)}
      </span>
    </label>
  );
}

function Toggle({
  isOn,
  onClick,
  title,
  description,
}: {
  readonly isOn: boolean;
  readonly onClick: () => void;
  readonly title: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={onClick}
      className={cn(
        'rounded-input border border-line p-2.5 text-left transition-all duration-hover ease-out',
        'hover:border-accent/35',
        isOn && 'border-accent/50 bg-accent/[.06]',
      )}
    >
      <span className="flex items-center gap-2 text-[12.5px] font-medium">
        <span
          className={cn(
            'flex h-[18px] w-[30px] flex-shrink-0 items-center rounded-full border px-[2px]',
            'transition-colors duration-hover',
            isOn ? 'border-accent bg-accent/[.25]' : 'border-line bg-tint/[.06]',
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'h-[12px] w-[12px] rounded-full bg-current transition-transform duration-hover ease-out',
              isOn ? 'translate-x-[12px] text-accent' : 'text-t3',
            )}
          />
        </span>
        {title}
      </span>
      <span className="mt-1 block pl-[38px] text-[10.5px] leading-[1.45] text-t3">
        {description}
      </span>
    </button>
  );
}

function Chip({
  isActive,
  onClick,
  children,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[11.5px] transition-all duration-hover ease-out',
        isActive
          ? 'border-accent/60 bg-accent/[.1] text-accent'
          : 'border-line text-t3 hover:border-accent/30 hover:text-t2',
      )}
    >
      {children}
    </button>
  );
}
