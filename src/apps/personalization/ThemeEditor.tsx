import { useState } from 'react';
import { AlertTriangle, Check, Palette, Trash2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { notificationService } from '@/services/notification-service';
import { useCustomThemeStore } from '@/stores/use-custom-theme-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { DEFAULT_THEME } from '@/design-system/tokens';
import {
  contrastRatio,
  customSwatches,
  deriveOverrides,
  isLightColour,
  readabilityWarning,
  type CustomTheme,
} from '@/types/custom-theme';

/**
 * Editor de temas (Parte 15 §Editor de temas personalizados).
 *
 * Três escolhas — acento, fundo e base clara ou escura — e os outros doze
 * tokens derivam daí. Um formulário com os quinze daria combinações ilegíveis
 * e ninguém o preencheria até ao fim.
 *
 * A pré-visualização é feita das cores derivadas, e não do tema em vigor:
 * mostra o que se vai obter antes de se guardar seja o que for.
 */

const INITIAL = { name: '', accent: '#00CFFF', background: '#05070A', isLight: false };

export function ThemeEditor(): React.JSX.Element {
  const themes = useCustomThemeStore((state) => state.themes);
  const add = useCustomThemeStore((state) => state.add);
  const remove = useCustomThemeStore((state) => state.remove);

  const current = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [draft, setDraft] = useState(INITIAL);

  const warning = readabilityWarning(draft);
  const preview = deriveOverrides(draft);

  const change = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]): void => {
    setDraft((previous) => {
      const next = { ...previous, [key]: value };

      // Escolher um fundo claro sem trocar a base dava texto branco sobre
      // branco. Acompanha a escolha, e continua a poder ser invertido à mão.
      if (key === 'background' && typeof value === 'string') {
        return { ...next, isLight: isLightColour(value) };
      }

      return next;
    });
  };

  const save = (): void => {
    const created = add(draft);
    setTheme(created.id);

    // Só o nome se limpa. As cores ficam: a pré-visualização passaria a
    // mostrar o tema base enquanto o sistema inteiro já estava com o novo, e
    // quem quer uma variante começa de onde estava.
    setDraft((previous) => ({ ...previous, name: '' }));

    notificationService.success('Tema criado', `${created.name} está agora ativo.`);
  };

  return (
    <>
      <p className="mb-3 text-[11.5px] leading-[1.5] text-t3">
        Escolha o acento e o fundo. As restantes doze cores — superfícies, linhas e níveis de texto
        — derivam daí, com as mesmas proporções dos temas oficiais.
      </p>

      <div className="mb-s3 grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ColourField
          label="Acento"
          value={draft.accent}
          onChange={(value) => change('accent', value)}
        />
        <ColourField
          label="Fundo"
          value={draft.background}
          onChange={(value) => change('background', value)}
        />
      </div>

      <div className="mb-s3 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-t3">Base</span>
        {([false, true] as const).map((isLight) => (
          <button
            key={String(isLight)}
            type="button"
            role="radio"
            aria-checked={draft.isLight === isLight}
            onClick={() => change('isLight', isLight)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10.5px] transition-all duration-hover ease-out',
              draft.isLight === isLight
                ? 'border-accent bg-accent/[.1] text-accent'
                : 'border-line text-t3 hover:border-accent/35 hover:text-t2',
            )}
          >
            {isLight ? 'Clara' : 'Escura'}
          </button>
        ))}
      </div>

      <Preview
        bg={preview.bg ?? '#000000'}
        card={preview.card ?? '#101922'}
        accent={preview.accent ?? '#00CFFF'}
        t1={preview.t1 ?? '#FFFFFF'}
        t3={preview.t3 ?? '#7E91A8'}
        ratio={contrastRatio(preview.t1 ?? '#FFFFFF', preview.bg ?? '#000000')}
      />

      {warning && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-warn">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}

      <div className="mt-s3 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nome do tema</span>
          <input
            value={draft.name}
            onChange={(event) => change('name', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
            }}
            placeholder="Nome do tema"
            className={cn(
              'w-full rounded-input border border-line bg-tint/[.03] px-3 py-2',
              'text-[12.5px] outline-none transition-colors duration-hover',
              'placeholder:text-t3 focus:border-accent/45',
            )}
          />
        </label>

        <button
          type="button"
          onClick={save}
          className={cn(
            'flex flex-shrink-0 items-center gap-2 rounded-btn border border-line px-3.5 py-2',
            'text-[12.5px] font-medium text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:bg-accent/[.05] hover:text-accent active:scale-[.98]',
          )}
        >
          <Palette className="h-3.5 w-3.5" aria-hidden="true" />
          Criar tema
        </button>
      </div>

      {themes.length > 0 && (
        <>
          <p className="t-label mb-2 mt-s3">Os meus temas</p>
          <ul className="space-y-1.5">
            {themes.map((theme) => (
              <CustomThemeRow
                key={theme.id}
                theme={theme}
                isActive={theme.id === current}
                onApply={() => setTheme(theme.id)}
                onRemove={() => {
                  // Apagar o tema em vigor deixaria o ecrã com cores de um
                  // tema que já não existe.
                  if (theme.id === current) setTheme(DEFAULT_THEME);
                  remove(theme.id);
                }}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function CustomThemeRow({
  theme,
  isActive,
  onApply,
  onRemove,
}: {
  readonly theme: CustomTheme;
  readonly isActive: boolean;
  readonly onApply: () => void;
  readonly onRemove: () => void;
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onApply}
        aria-current={isActive ? 'true' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-input border px-3 py-2 text-left',
          'transition-all duration-hover ease-out hover:border-accent/35 hover:bg-accent/[.04]',
          isActive ? 'border-accent bg-accent/[.08]' : 'border-line',
        )}
      >
        <span className="flex flex-shrink-0 gap-1" aria-hidden="true">
          {customSwatches(theme).map((swatch, index) => (
            <span
              key={index}
              className="h-[14px] w-[14px] rounded-[5px] border border-tint/10"
              style={{ background: swatch }}
            />
          ))}
        </span>

        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{theme.name}</span>

        {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Apagar o tema ${theme.name}`}
        className="flex-shrink-0 rounded p-2 text-t3 transition-colors duration-hover hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Amostra do resultado.
 *
 * Estilos em linha, e não classes: são as cores derivadas do rascunho, que por
 * definição não estão em nenhuma variável do sistema.
 */
function Preview({
  bg,
  card,
  accent,
  t1,
  t3,
  ratio,
}: {
  readonly bg: string;
  readonly card: string;
  readonly accent: string;
  readonly t1: string;
  readonly t3: string;
  readonly ratio: number;
}): React.JSX.Element {
  return (
    <div
      className="rounded-card border border-line p-3"
      style={{ background: bg }}
      aria-label="Pré-visualização do tema"
      role="img"
    >
      <div className="rounded-input p-2.5" style={{ background: card }}>
        <p className="text-[13px] font-medium" style={{ color: t1 }}>
          Texto principal
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: t3 }}>
          Texto secundário, o mais discreto dos três.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-btn px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: accent, color: bg }}
          >
            Ação
          </span>
          <span className="mono text-[10px]" style={{ color: t3 }}>
            contraste {ratio.toFixed(1)}:1
          </span>
        </div>
      </div>
    </div>
  );
}

function ColourField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 rounded-input border border-line px-2.5 py-1.5">
      <span className="flex-1 text-[11.5px] text-t3">{label}</span>
      <span className="mono text-[10.5px] text-t2">{value.toUpperCase()}</span>
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-[22px] w-[30px] flex-shrink-0 cursor-pointer rounded border border-line bg-transparent p-0"
      />
    </label>
  );
}
