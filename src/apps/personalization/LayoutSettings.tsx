import { useState } from 'react';
import { LayoutGrid, Save, Trash2 } from 'lucide-react';

import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/cn';
import { notificationService } from '@/services/notification-service';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import type { SoundSnapshot } from '@/services/sound-service';
import type { SavedLayout } from '@/types/workspace';

/**
 * Layouts guardados (Parte 6.2 §Layouts salvos e Parte 15 §Perfis).
 *
 * Um layout é uma fotografia do espaço de trabalho — janelas abertas, widgets
 * e as suas posições, tema, ambiente, som e plugins ativos. Aplicá-lo repõe
 * tudo isso, e **não** repõe a acessibilidade: ver `AMBIENCE_KEYS`.
 *
 * O texto em cima diz exatamente o que a fotografia leva. Uma pessoa que
 * carrega em "Produtividade" e vê o volume mudar tem de conseguir saber
 * porquê antes de carregar, e não depois.
 *
 * Os seis que vêm com o sistema não se apagam: voltariam no arranque seguinte,
 * vindos do código, e a interface parecia ignorar o pedido.
 */
export function LayoutSettings(): React.JSX.Element {
  const layouts = useWorkspaceStore((state) => state.layouts);
  const saveLayout = useWorkspaceStore((state) => state.saveLayout);
  const removeLayout = useWorkspaceStore((state) => state.removeLayout);
  const { applyLayout } = useWorkspace();

  const [name, setName] = useState('');

  const save = (): void => {
    const saved = saveLayout(name);
    setName('');
    notificationService.success(
      'Layout guardado',
      `"${saved.name}" guarda ${saved.snapshot.windows.length} ${
        saved.snapshot.windows.length === 1 ? 'janela' : 'janelas'
      }, ${saved.snapshot.widgets.filter((widget) => widget.isVisible).length} widgets e ${soundSummary(
        saved.snapshot.sound,
      )}.`,
    );
  };

  const builtIn = layouts.filter((layout) => layout.isBuiltIn);
  const mine = layouts.filter((layout) => !layout.isBuiltIn);

  return (
    <>
      <p className="mb-2 text-[11.5px] leading-[1.5] text-t3">
        Cada layout guarda as janelas abertas, os widgets e onde estão, o tema, o ambiente (papel de
        parede, cursor, partículas do núcleo), o som e que plugins estavam ativos.
      </p>
      <p className="mb-3 text-[11.5px] leading-[1.5] text-t3">
        Não guarda a acessibilidade: contraste alto, correção de daltonismo, escala da interface e
        bloqueio por inatividade ficam sempre como os deixou.
      </p>

      <div className="mb-s3 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nome do layout a guardar</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
            }}
            placeholder="Nome do layout"
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
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          Guardar o atual
        </button>
      </div>

      <p className="t-label mb-2">Do sistema</p>
      <ul className="mb-s3 space-y-1.5">
        {builtIn.map((layout) => (
          <LayoutRow key={layout.id} layout={layout} onApply={() => applyLayout(layout.id)} />
        ))}
      </ul>

      <p className="t-label mb-2">Guardados por si</p>
      {mine.length === 0 ? (
        <p className="text-[11.5px] text-t3">
          Nenhum ainda. Arrume o ecrã como quer e carregue em "Guardar o atual".
        </p>
      ) : (
        <ul className="space-y-1.5">
          {mine.map((layout) => (
            <LayoutRow
              key={layout.id}
              layout={layout}
              onApply={() => applyLayout(layout.id)}
              onRemove={() => removeLayout(layout.id)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Como se descreve o som de um perfil numa linha.
 *
 * `null` é o caso de um layout guardado antes de os perfis levarem som: dizer
 * "sem som" era mentira — o que ele faz é não mexer no que está.
 */
function soundSummary(sound: SoundSnapshot | null): string {
  if (sound === null) return 'não mexe no som';
  if (!sound.isEnabled) return 'som desligado';
  return `som a ${Math.round(sound.volume * 100)}%`;
}

function LayoutRow({
  layout,
  onApply,
  onRemove,
}: {
  readonly layout: SavedLayout;
  readonly onApply: () => void;
  readonly onRemove?: () => void;
}): React.JSX.Element {
  const visibleWidgets = layout.snapshot.widgets.filter((widget) => widget.isVisible).length;

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onApply}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-input border border-line px-3 py-2 text-left',
          'transition-all duration-hover ease-out hover:border-accent/35 hover:bg-accent/[.04]',
        )}
      >
        <LayoutGrid className="h-4 w-4 flex-shrink-0 text-t3" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium">{layout.name}</span>
          <span className="block truncate text-[11px] text-t3">
            {layout.description.length > 0
              ? layout.description
              : `${layout.snapshot.windows.length} janelas · ${visibleWidgets} widgets · ${soundSummary(layout.snapshot.sound)}`}
          </span>
        </span>
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Apagar o layout ${layout.name}`}
          className="flex-shrink-0 rounded p-2 text-t3 transition-colors duration-hover hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
