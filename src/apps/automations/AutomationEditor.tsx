import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { ArrowRight, Check, Clock, Globe, MessageSquare, Moon, Settings, Trash2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { appTitle, stateName, themeName, widgetName } from '@/lib/names';
import { aiService } from '@/services/ai-service';
import { automationService } from '@/services/automation-service';
import { logService } from '@/services/log-service';
import { THEMES } from '@/design-system/tokens';
import { ALL_APPS } from '@/apps/registry';
import { ALL_WIDGETS } from '@/widgets/registry';
import { SYSTEM_STATES } from '@/types/system-state';
import {
  WEEKDAY_LABELS,
  type Automation,
  type AutomationAction,
  type AutomationCondition,
  type AutomationTrigger,
} from '@/types/automation';

// ─── Tipos do editor ─────────────────────────────────────────────────────

type ColumnKind = 'quando' | 'se' | 'entao';

interface EditorBlock {
  readonly id: string;
  readonly kind: ColumnKind;
  readonly config: AutomationTrigger | AutomationCondition | AutomationAction;
}

// ─── Blocos disponíveis ──────────────────────────────────────────────────

interface BlockTemplate {
  readonly kind: ColumnKind;
  readonly label: string;
  readonly icon: React.ReactNode;
  /** Cria um bloco novo com valores por omissão. */
  create(): AutomationTrigger | AutomationCondition | AutomationAction;
}

const BLOCK_TEMPLATES: readonly BlockTemplate[] = [
  // Gatilhos (Quando)
  {
    kind: 'quando',
    label: 'Hora do dia',
    icon: <Clock className="h-3.5 w-3.5" />,
    create: (): AutomationTrigger => ({ kind: 'hora', hour: 8, minute: 0 }),
  },
  {
    kind: 'quando',
    label: 'Intervalo',
    icon: <Clock className="h-3.5 w-3.5" />,
    create: (): AutomationTrigger => ({ kind: 'intervalo', everyMinutes: 30 }),
  },
  {
    kind: 'quando',
    label: 'Evento do sistema',
    icon: <Globe className="h-3.5 w-3.5" />,
    create: (): AutomationTrigger => ({ kind: 'evento', event: 'desktop:carregado' }),
  },
  {
    kind: 'quando',
    label: 'Execução manual',
    icon: <Settings className="h-3.5 w-3.5" />,
    create: (): AutomationTrigger => ({ kind: 'manual' }),
  },
  // Condições (Se)
  {
    kind: 'se',
    label: 'Dia da semana',
    icon: <Clock className="h-3.5 w-3.5" />,
    create: (): AutomationCondition => ({ kind: 'dia-da-semana', days: [1, 2, 3, 4, 5] }),
  },
  {
    kind: 'se',
    label: 'Faixa horária',
    icon: <Clock className="h-3.5 w-3.5" />,
    create: (): AutomationCondition => ({ kind: 'faixa-horaria', fromHour: 9, toHour: 18 }),
  },
  {
    kind: 'se',
    label: 'Estado do sistema',
    icon: <Moon className="h-3.5 w-3.5" />,
    create: (): AutomationCondition => ({ kind: 'estado-sistema', state: 'normal' }),
  },
  // Ações (Então)
  {
    kind: 'entao',
    label: 'Abrir janela',
    icon: <Globe className="h-3.5 w-3.5" />,
    create: (): AutomationAction => ({ kind: 'abrir-janela', appId: 'assistant' }),
  },
  {
    kind: 'entao',
    label: 'Notificar',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    create: (): AutomationAction => ({ kind: 'notificar', title: 'Título', description: 'Descrição' }),
  },
  {
    kind: 'entao',
    label: 'Mudar tema',
    icon: <Moon className="h-3.5 w-3.5" />,
    create: (): AutomationAction => ({ kind: 'tema', theme: 'midnight' }),
  },
  {
    kind: 'entao',
    label: 'Mudar estado',
    icon: <Settings className="h-3.5 w-3.5" />,
    create: (): AutomationAction => ({ kind: 'estado-sistema', state: 'normal' }),
  },
  {
    kind: 'entao',
    label: 'Mostrar widget',
    icon: <Globe className="h-3.5 w-3.5" />,
    create: (): AutomationAction => ({ kind: 'widget', widget: 'clock', show: true }),
  },
  {
    kind: 'entao',
    label: 'Falar',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    create: (): AutomationAction => ({ kind: 'falar', text: '' }),
  },
];

// ─── Bloco no editor ─────────────────────────────────────────────────────

function blockLabel(config: AutomationTrigger | AutomationCondition | AutomationAction): string {
  switch (config.kind) {
    case 'hora': return `Às ${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
    case 'intervalo': return `De ${config.everyMinutes} em ${config.everyMinutes} min`;
    case 'evento': return `Ao evento "${config.event}"`;
    case 'manual': return 'Execução manual';
    case 'dia-da-semana': return config.days.map((d) => WEEKDAY_LABELS[d] ?? '?').join(', ');
    case 'faixa-horaria': return `${config.fromHour}h–${config.toHour}h`;
    case 'estado-sistema': return `Modo ${stateName(config.state)}`;
    case 'abrir-janela': return `Abrir ${appTitle(config.appId)}`;
    case 'notificar': return `Notificar "${config.title}"`;
    case 'tema': return `Tema ${themeName(config.theme)}`;
    case 'widget': return `${config.show ? 'Mostrar' : 'Esconder'} ${widgetName(config.widget)}`;
    case 'falar': return `Dizer "${config.text || '(vazio)'}"`;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────

interface AutomationEditorProps {
  readonly onClose: () => void;
  readonly onSaved: () => void;
  /** Automação existente para editar — undefined = nova. */
  readonly existing?: Automation;
}

// ─── Componente principal ─────────────────────────────────────────────────

export function AutomationEditor({ onClose, onSaved, existing }: AutomationEditorProps): React.JSX.Element {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [blocks, setBlocks] = useState<readonly EditorBlock[]>(() =>
    existing ? automationToBlocks(existing) : [],
  );
  const [nlPrompt, setNlPrompt] = useState('');
  const [isGenerating, setGenerating] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);

  const columns = useMemo(() => ({
    quando: blocks.filter((b) => b.kind === 'quando'),
    se: blocks.filter((b) => b.kind === 'se'),
    entao: blocks.filter((b) => b.kind === 'entao'),
  }), [blocks]);

  const handleDrop = useCallback((col: ColumnKind) => (event: DragEvent) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/x-automation-block');
    if (!raw) return;
    const template = JSON.parse(raw) as { label: string; config: unknown };
    const block: EditorBlock = {
      id: `bloco-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: col,
      config: template.config as AutomationTrigger | AutomationCondition | AutomationAction,
    };
    setBlocks((prev) => [...prev, block]);
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const save = useCallback(() => {
    if (!name.trim()) return;
    const trigger = columns.quando[0]?.config as AutomationTrigger | undefined;
    if (!trigger) return;

    const conditions = columns.se.map((b) => b.config as AutomationCondition);
    const actions = columns.entao.map((b) => b.config as AutomationAction);
    if (actions.length === 0) return;

    if (existing) {
      automationService.remove(existing.id);
    }

    automationService.add({
      name: name.trim(),
      description: description.trim(),
      trigger,
      conditions,
      actions,
      isEnabled: existing?.isEnabled ?? true,
    });

    logService.log('info', 'automacao', `Automação "${name.trim()}" guardada via editor visual`);
    onSaved();
  }, [name, description, columns, existing, onSaved]);

  const generateFromNL = useCallback(async () => {
    if (!nlPrompt.trim()) return;
    setGenerating(true);
    setNlError(null);
    try {
      const prompt = `Interpreta esta frase em português como uma automação JARVIS com blocos QUANDO/SE/ENTÃO. Responde só com JSON válido, sem mais texto:\n\n"${nlPrompt.trim()}"\n\nEstrutura:\n{\n  "nome": "nome curto",\n  "descricao": "uma frase",\n  "quando": { gatilho },\n  "se": [condições],\n  "entao": [ações]\n}\n\nGatilhos: hora (hour,minute), intervalo (everyMinutes), evento (event), manual\nCondições: dia-da-semana (days: 0=dom..6=sáb), faixa-horaria (fromHour,toHour), estado-sistema (state)\nAções: abrir-janela (appId), notificar (title,description), tema (theme), estado-sistema (state), widget (widget,show), falar (text)\nIDs reais: apps=[${ALL_APPS.map(a => a.id).join(',')}], temas=[${THEMES.map(t => t.id).join(',')}], widgets=[${ALL_WIDGETS.map(w => w.id).join(',')}], estados=[${Object.keys(SYSTEM_STATES).join(',')}]`;
      const reply = await aiService.send(prompt);
      if (reply.length === 0) {
        setNlError('O assistente não respondeu nada — tente outra vez.');
        return;
      }

      // Tenta extrair JSON da resposta
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        setNlError(
          `Não consegui perceber isso como automação. O assistente respondeu: "${reply.slice(0, 140)}"`,
        );
        return;
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        nome?: string;
        descricao?: string;
        quando?: AutomationTrigger;
        se?: AutomationCondition[];
        entao?: AutomationAction[];
      };

      if (parsed.nome) setName(parsed.nome);
      if (parsed.descricao) setDescription(parsed.descricao);

      const newBlocks: EditorBlock[] = [];
      if (parsed.quando) {
        newBlocks.push({ id: `quando-${Date.now()}`, kind: 'quando', config: parsed.quando });
      }
      for (const cond of parsed.se ?? []) {
        newBlocks.push({ id: `se-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind: 'se', config: cond });
      }
      for (const acao of parsed.entao ?? []) {
        newBlocks.push({ id: `entao-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind: 'entao', config: acao });
      }
      setBlocks(newBlocks);
      logService.log('info', 'automacao', 'Automação gerada por linguagem natural');
    } catch (err) {
      const message = (err as Error).message;
      setNlError(`Não consegui interpretar: ${message}`);
      logService.log('erro', 'automacao', 'Falha ao interpretar automação', message);
    } finally {
      setGenerating(false);
    }
  }, [nlPrompt]);

  const canSave = name.trim() && columns.quando.length > 0 && columns.entao.length > 0;

  return (
    <div className="flex h-full flex-col gap-s2">
      {/* Cabeçalho */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da automação"
          aria-label="Nome"
          className="min-w-0 flex-1 rounded-input border border-line bg-tint/[.03] px-2.5 py-2 text-[13px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
        />
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={cn(
            'flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12px] font-medium transition-all duration-hover',
            canSave
              ? 'bg-accent text-[#04121A] hover:shadow-glow'
              : 'border border-line bg-tint/[.03] text-t3',
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Guardar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-btn border border-line px-3 py-2 text-[12px] text-t2 transition-colors duration-hover hover:text-t1"
        >
          Cancelar
        </button>
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        aria-label="Descrição"
        className="flex-shrink-0 rounded-input border border-line bg-tint/[.03] px-2.5 py-1.5 text-[11.5px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
      />

      {/* Três colunas */}
      <div className="flex min-h-0 flex-1 gap-2">
        {(['quando', 'se', 'entao'] as const).map((col) => (
          <DropColumn
            key={col}
            kind={col}
            blocks={columns[col]}
            onDrop={handleDrop(col)}
            onDragOver={handleDragOver}
            onRemove={removeBlock}
          />
        ))}
      </div>

      {/* Paleta de blocos */}
      <div className="flex-shrink-0">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-t3">
          Arrasta blocos para as colunas
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TEMPLATES.map((template) => (
            <DraggableBlock key={template.label} template={template} />
          ))}
        </div>
      </div>

      {/* Criação por linguagem natural */}
      <div className="flex-shrink-0 rounded-input border border-line bg-tint/[.03] p-2.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-t3">
          Ou descreve em português
        </p>
        <div className="flex gap-2">
          <input
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void generateFromNL(); }}
            placeholder="Ex.: todos os dias às 8 da manhã, se for dia de semana, abre o assistente e diz bom dia"
            aria-label="Descrever automação em português"
            className="min-w-0 flex-1 rounded-input border border-line bg-tint/[.03] px-2.5 py-2 text-[11.5px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
          />
          <button
            type="button"
            onClick={() => void generateFromNL()}
            disabled={!nlPrompt.trim() || isGenerating}
            className={cn(
              'flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12px] font-medium transition-all duration-hover',
              nlPrompt.trim() && !isGenerating
                ? 'bg-accent text-[#04121A] hover:shadow-glow'
                : 'border border-line bg-tint/[.03] text-t3',
            )}
          >
            {isGenerating ? 'A pensar…' : 'Interpretar'}
          </button>
        </div>
        {nlError !== null && (
          <p role="alert" className="mt-1.5 text-[11px] text-danger">
            {nlError}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Coluna ───────────────────────────────────────────────────────────────

const COLUMN_LABELS: Record<ColumnKind, string> = { quando: 'QUANDO', se: 'SE', entao: 'ENTÃO' };

function DropColumn({
  kind,
  blocks,
  onDrop,
  onDragOver,
  onRemove,
}: {
  readonly kind: ColumnKind;
  readonly blocks: readonly EditorBlock[];
  readonly onDrop: (event: DragEvent) => void;
  readonly onDragOver: (event: DragEvent) => void;
  readonly onRemove: (id: string) => void;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-input border transition-colors duration-hover',
        'border-line bg-tint/[.02]',
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <p className="flex-shrink-0 border-b border-line px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-t3">
        {COLUMN_LABELS[kind]}
      </p>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="flex items-center gap-1.5 rounded border border-accent/30 bg-accent/[.06] px-2.5 py-2 text-[11.5px] text-t2"
          >
            <ArrowRight className="h-3 w-3 flex-shrink-0 text-accent/60" />
            <span className="min-w-0 flex-1">{blockLabel(block.config)}</span>
            <button
              type="button"
              onClick={() => onRemove(block.id)}
              aria-label="Remover bloco"
              className="flex-shrink-0 rounded p-0.5 text-t3 transition-colors duration-hover hover:text-danger"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="py-4 text-center text-[10.5px] text-t3">Arrasta um bloco para aqui</p>
        )}
      </div>
    </div>
  );
}

// ─── Bloco arrastável ────────────────────────────────────────────────────

function DraggableBlock({ template }: { readonly template: BlockTemplate }): React.JSX.Element {
  const handleDragStart = useCallback(
    (event: DragEvent) => {
      const config = template.create();
      event.dataTransfer.setData(
        'application/x-automation-block',
        JSON.stringify({ label: template.label, config }),
      );
      event.dataTransfer.effectAllowed = 'copy';
    },
    [template],
  );

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      className="flex cursor-grab items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-[11px] text-t2 transition-all duration-hover hover:border-accent/35 hover:text-accent active:cursor-grabbing"
    >
      {template.icon}
      {template.label}
    </button>
  );
}

// ─── Conversão Automation ↔ blocos ───────────────────────────────────────

function automationToBlocks(automation: Automation): readonly EditorBlock[] {
  const blocks: EditorBlock[] = [];
  blocks.push({ id: `quando-${automation.id}`, kind: 'quando', config: automation.trigger });
  for (const cond of automation.conditions) {
    blocks.push({ id: `se-${automation.id}-${Math.random().toString(36).slice(2, 5)}`, kind: 'se', config: cond });
  }
  for (const action of automation.actions) {
    blocks.push({ id: `entao-${automation.id}-${Math.random().toString(36).slice(2, 5)}`, kind: 'entao', config: action });
  }
  return blocks;
}
