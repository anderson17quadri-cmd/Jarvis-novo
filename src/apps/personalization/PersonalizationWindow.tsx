import { Check, RotateCcw } from 'lucide-react';

import { THEMES } from '@/design-system/tokens';
import { cn } from '@/lib/cn';
import { notificationService } from '@/services/notification-service';
import { useSessionStore } from '@/stores/use-session-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { AiSettings } from './AiSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { LayoutSettings } from './LayoutSettings';
import { MailSettings } from './MailSettings';
import { MusicSettings } from './MusicSettings';
import { NewsSettings } from './NewsSettings';
import { SoundSettings } from './SoundSettings';
import { ThemeEditor } from './ThemeEditor';
import { SystemStatePicker } from './SystemStatePicker';
import { VoiceSettings } from './VoiceSettings';
import { WeatherSettings } from './WeatherSettings';

/**
 * Personalização.
 *
 * Trocar de tema é uma linha: o `useThemeStore` escreve `data-theme` no `<html>`
 * e todo o sistema muda, porque nada usa cores literais.
 */
export default function PersonalizationWindow(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const restartBootSequence = useSessionStore((state) => state.restartBootSequence);

  return (
    <div>
      <p className="t-label mb-3">Temas do sistema</p>

      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
        role="radiogroup"
        aria-label="Temas do sistema"
      >
        {THEMES.map((definition) => {
          const isActive = definition.id === theme;

          return (
            <button
              key={definition.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => {
                setTheme(definition.id);
                notificationService.success(
                  'Tema aplicado',
                  `${definition.name} está agora ativo.`,
                );
              }}
              className={cn(
                'rounded-input border border-line p-3 text-left transition-all duration-hover ease-out',
                'hover:border-accent/35 hover:bg-accent/[.04]',
                isActive && 'border-accent bg-accent/[.08]',
              )}
            >
              <span className="mb-[9px] flex gap-1">
                {definition.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="h-[14px] w-[14px] rounded-[5px] border border-tint/10"
                    style={{ background: swatch }}
                    aria-hidden="true"
                  />
                ))}
              </span>

              <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                {definition.name}
                {isActive && <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Assistente</p>
        <AiSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Meteorologia</p>
        <WeatherSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Notícias</p>
        <NewsSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Correio</p>
        <MailSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Música</p>
        <MusicSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Voz</p>
        <VoiceSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Tema personalizado</p>
        <ThemeEditor />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <AppearanceSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Layouts</p>
        <LayoutSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Estado do sistema</p>
        <p className="mb-3 text-[11.5px] leading-[1.5] text-t3">
          Cada estado muda o que interrompe, quantas partículas o núcleo desenha e a que
          ritmo o sistema se sonda a si próprio.
        </p>
        <SystemStatePicker />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Som</p>
        <SoundSettings />
      </section>

      <section className="mt-s4 border-t border-line pt-s3">
        <p className="t-label mb-2">Arranque</p>
        <p className="mb-3 text-[11.5px] leading-[1.5] text-t3">
          A sequência completa só corre na primeira vez. Reponha-a para a ver de novo — o
          sistema recarrega.
        </p>

        <button
          type="button"
          onClick={() => void restartBootSequence()}
          className={cn(
            'flex items-center gap-2 rounded-btn border border-line px-4 py-2.5',
            'text-[12.5px] font-medium text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:bg-accent/[.05] hover:text-accent active:scale-[.98]',
          )}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Mostrar sequência completa de arranque
        </button>
      </section>
    </div>
  );
}
