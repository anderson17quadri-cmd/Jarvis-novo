import { logService } from '../log-service';
import { getTool, validateArgs, type ToolDefinition } from './tools';

/**
 * Execução de ferramentas (Parte 7.2 §Agentes).
 *
 * O modelo escolhe **o quê**; isto trata do **como**. Quem cumpre é um executor
 * injetado de fora — o mesmo padrão da Command Palette, das automações e da
 * voz, e pela mesma razão: sem ele, este ficheiro conhecia metade do sistema.
 *
 * Duas coisas acontecem sempre, e não se podem desligar:
 *
 * 1. **Tudo fica na auditoria** — o que foi pedido, com que argumentos, e como
 *    correu. É o único registo de quem mandou o quê.
 * 2. **O que perde dados espera por confirmação.** São três ferramentas. Não é
 *    para travar quem manda; é porque um modelo lê o que lhe puserem à frente,
 *    e um email a dizer "apaga tudo" não pode bastar.
 */

/** Quem sabe cumprir. Fornecido pela aplicação. */
export interface ToolExecutor {
  readonly openWindow: (app: string) => void;
  readonly closeWindow: (app: string) => void;
  readonly closeAllWindows: () => void;
  readonly setTheme: (theme: string) => void;
  readonly setWallpaper: (wallpaper: string) => void;
  readonly setSystemState: (state: string) => void;
  readonly setWidgetVisible: (widget: string, show: boolean) => void;
  readonly goToDesktop: (desktop: number) => void;
  readonly applyLayout: (layout: string) => boolean;
  readonly saveLayout: (name: string) => void;
  readonly createTask: (title: string, priority: string, dueAt: number | null) => void;
  readonly completeTask: (title: string) => boolean;
  readonly clearDoneTasks: () => number;
  readonly notify: (title: string, description: string) => void;
  readonly search: (query: string) => void;
  readonly music: (action: string) => void;
  readonly speak: (text: string) => void;
  readonly setAutomationEnabled: (name: string, enabled: boolean) => boolean;
  readonly runAutomation: (name: string) => boolean;
  readonly clearConversations: () => void;
  readonly forgetMemory: () => void;
  readonly resetWidgets: () => void;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export type ToolOutcome =
  | { readonly status: 'ok'; readonly message: string }
  | { readonly status: 'erro'; readonly message: string }
  /** À espera de confirmação. A interface pergunta; nada foi feito ainda. */
  | { readonly status: 'confirmar'; readonly message: string };

let executor: ToolExecutor | null = null;

/** Regista quem cumpre. Devolve a função que o retira. */
export function setToolExecutor(next: ToolExecutor): () => void {
  executor = next;

  return () => {
    // Só limpar se ainda for este — desmontar um componente antigo não pode
    // apagar o executor que outro registou entretanto.
    if (executor === next) executor = null;
  };
}

/**
 * Corre uma ferramenta.
 *
 * `confirmed` só chega a `true` depois de a pessoa ter dito que sim. O modelo
 * não o pode pedir: o argumento vem da interface, não do pedido.
 */
export function runTool(call: ToolCall, confirmed = false): ToolOutcome {
  const tool = getTool(call.name);

  // Uma ferramenta que não existe não é um erro a esconder: é o modelo a
  // inventar, e vale a pena ficar no registo.
  if (!tool) {
    logService.log('aviso', 'assistente', `Ferramenta desconhecida: ${call.name}`);
    return { status: 'erro', message: `Não sei fazer "${call.name}".` };
  }

  const invalid = validateArgs(tool, call.args);
  if (invalid) {
    logService.log('aviso', 'assistente', `Argumentos inválidos em ${call.name}`, invalid);
    return { status: 'erro', message: invalid };
  }

  if (tool.risk === 'perde' && !confirmed) {
    return {
      status: 'confirmar',
      message: tool.confirmation?.(call.args) ?? 'Isto não se pode desfazer.',
    };
  }

  if (!executor) {
    return { status: 'erro', message: 'O assistente não está ligado ao sistema.' };
  }

  try {
    const message = perform(tool, call.args, executor);
    logService.audit(`Assistente: ${describe(call)}`, 'executado', message);
    return { status: 'ok', message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    logService.audit(`Assistente: ${describe(call)}`, 'recusado', message);
    return { status: 'erro', message };
  }
}

/** Uma linha legível do que foi pedido, para a auditoria. */
export function describe(call: ToolCall): string {
  const args = Object.entries(call.args)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');

  return args.length > 0 ? `${call.name}(${args})` : `${call.name}()`;
}

/**
 * Lê "AAAA-MM-DD" como meia-noite local desse dia. `null` se vazio ou se o
 * modelo mandar algo que não é essa forma — uma tarefa sem prazo é melhor do
 * que uma com um prazo inventado.
 */
function parseDueDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/**
 * O que cada ferramenta faz, e o que responde ao modelo.
 *
 * A resposta importa tanto como a ação: é com ela que o modelo sabe se
 * continua ou se explica. "Não encontrei nenhuma tarefa com esse nome" leva-o
 * a perguntar; um silêncio leva-o a inventar que correu bem.
 */
function perform(
  tool: ToolDefinition,
  args: Readonly<Record<string, unknown>>,
  run: ToolExecutor,
): string {
  // Os tipos já foram validados; isto é só para o TypeScript. Um valor que não
  // seja texto nunca chega aqui.
  const text = (name: string): string => {
    const value = args[name];
    return typeof value === 'string' ? value : '';
  };

  switch (tool.name) {
    case 'abrir_janela':
      run.openWindow(text('app'));
      return `Janela ${text('app')} aberta.`;

    case 'fechar_janela':
      run.closeWindow(text('app'));
      return `Janela ${text('app')} fechada.`;

    case 'fechar_todas_as_janelas':
      run.closeAllWindows();
      return 'Todas as janelas fechadas.';

    case 'mudar_tema':
      run.setTheme(text('tema'));
      return `Tema ${text('tema')} aplicado.`;

    case 'mudar_papel_de_parede':
      run.setWallpaper(text('papel'));
      return `Papel de parede ${text('papel')}.`;

    case 'mudar_estado_do_sistema':
      run.setSystemState(text('estado'));
      return `Modo ${text('estado')}.`;

    case 'mostrar_widget':
      run.setWidgetVisible(text('widget'), true);
      return `Widget ${text('widget')} à vista.`;

    case 'esconder_widget':
      run.setWidgetVisible(text('widget'), false);
      return `Widget ${text('widget')} escondido.`;

    case 'mudar_de_desktop':
      run.goToDesktop(Number(args['desktop']));
      return `No desktop ${String(args['desktop'])}.`;

    case 'aplicar_layout':
      return run.applyLayout(text('layout'))
        ? `Layout ${text('layout')} aplicado.`
        : `Não encontrei o layout "${text('layout')}".`;

    case 'guardar_layout':
      run.saveLayout(text('nome'));
      return `Layout "${text('nome')}" guardado.`;

    case 'criar_tarefa': {
      const dueAt = parseDueDate(text('prazo'));
      run.createTask(text('titulo'), text('prioridade') || 'media', dueAt);
      const prazo = dueAt !== null ? `, para ${new Date(dueAt).toLocaleDateString('pt-PT')}` : '';
      return `Tarefa "${text('titulo')}" criada${prazo}.`;
    }

    case 'concluir_tarefa':
      return run.completeTask(text('titulo'))
        ? `Tarefa "${text('titulo')}" concluída.`
        : `Não encontrei nenhuma tarefa por fazer parecida com "${text('titulo')}".`;

    case 'apagar_tarefas_concluidas': {
      const removed = run.clearDoneTasks();
      return removed === 0
        ? 'Não havia tarefas concluídas para apagar.'
        : `${removed} ${removed === 1 ? 'tarefa apagada' : 'tarefas apagadas'}.`;
    }

    case 'notificar':
      run.notify(text('titulo'), text('descricao'));
      return 'Notificação mostrada.';

    case 'pesquisar':
      run.search(text('termo'));
      return `Pesquisa aberta com "${text('termo')}".`;

    case 'controlar_musica':
      run.music(text('acao'));
      return `Música: ${text('acao')}.`;

    case 'ler_em_voz_alta':
      run.speak(text('texto'));
      return 'Dito em voz alta.';

    case 'ligar_automacao': {
      const enabled = args['ligada'] === true;
      return run.setAutomationEnabled(text('nome'), enabled)
        ? `Automação "${text('nome')}" ${enabled ? 'ligada' : 'desligada'}.`
        : `Não encontrei a automação "${text('nome')}".`;
    }

    case 'executar_automacao':
      return run.runAutomation(text('nome'))
        ? `Automação "${text('nome')}" executada.`
        : `Não encontrei a automação "${text('nome')}".`;

    case 'apagar_conversas':
      run.clearConversations();
      return 'Histórico apagado.';

    case 'esquecer_memoria':
      run.forgetMemory();
      return 'Memória esquecida.';

    case 'repor_widgets':
      run.resetWidgets();
      return 'Arranjo predefinido reposto.';

    default:
      // Inalcançável enquanto o catálogo e este switch andarem a par. Se
      // alguém acrescentar uma ferramenta e esquecer isto, diz-se em vez de
      // fingir que correu.
      throw new Error(`A ferramenta "${tool.name}" não tem execução definida.`);
  }
}
