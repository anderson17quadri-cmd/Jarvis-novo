import { ALL_APPS } from '@/apps/registry';
import { THEMES } from '@/design-system/tokens';
import { ALL_SYSTEM_STATES } from '@/types/system-state';
import { ALL_WIDGETS } from '@/widgets/registry';
import { DESKTOP_IDS } from '@/types/workspace';

/**
 * O que o assistente sabe fazer (Parte 7.2 §Agentes).
 *
 * Um catálogo, não uma lista de permissões. A diferença importa: isto existe
 * para o modelo **saber o que pode pedir**, não para o travar. Um modelo que
 * inventa `apagar_disco` não é impedido por uma regra — é impedido por essa
 * ferramenta não existir.
 *
 * As opções de cada ferramenta vêm dos registos do sistema: acrescentar uma
 * janela, um tema ou um widget fá-los aparecer aqui sem tocar neste ficheiro.
 * É a mesma decisão da Command Palette, e pela mesma razão.
 */

/**
 * Quanto custa desfazer.
 *
 * - `livre` — reversível num gesto. A esmagadora maioria.
 * - `perde` — leva dados que não voltam. **Só estas pedem confirmação.**
 *
 * A lista das segundas é curta de propósito. Um assistente que pergunta a cada
 * passo é um assistente que se desliga.
 */
export type ToolRisk = 'livre' | 'perde';

export interface ToolParameter {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly description: string;
  /** Valores aceites. Vazio quando é texto livre. */
  readonly options?: readonly string[];
  readonly required: boolean;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: ToolRisk;
  readonly parameters: readonly ToolParameter[];
  /** O que se mostra ao pedir confirmação. Só as de risco `perde` a têm. */
  readonly confirmation?: (args: Readonly<Record<string, unknown>>) => string;
}

const appIds = ALL_APPS.map((app) => app.id);
const themeIds = THEMES.map((theme) => theme.id);
const widgetIds = ALL_WIDGETS.map((widget) => widget.id);
const stateIds = ALL_SYSTEM_STATES.map((state) => state.id);

function text(name: string, description: string, required = true): ToolParameter {
  return { name, type: 'string', description, required };
}

function choice(
  name: string,
  description: string,
  options: readonly string[],
  required = true,
): ToolParameter {
  return { name, type: 'string', description, options, required };
}

export const TOOLS: readonly ToolDefinition[] = [
  // ── Janelas ───────────────────────────────────────────────────────────────
  {
    name: 'abrir_janela',
    description: 'Abre uma janela do sistema. Se já estiver aberta, traz para a frente.',
    risk: 'livre',
    parameters: [choice('app', 'Qual a janela a abrir.', appIds)],
  },
  {
    name: 'fechar_janela',
    description: 'Fecha uma janela específica.',
    risk: 'livre',
    parameters: [choice('app', 'Qual a janela a fechar.', appIds)],
  },
  {
    name: 'fechar_todas_as_janelas',
    description: 'Fecha todas as janelas abertas de uma vez.',
    risk: 'livre',
    parameters: [],
  },

  // ── Aparência ─────────────────────────────────────────────────────────────
  {
    name: 'mudar_tema',
    description:
      'Aplica um tema. Além dos oficiais, aceita o identificador de um tema criado pelo utilizador.',
    risk: 'livre',
    parameters: [
      text('tema', `Identificador do tema. Oficiais: ${themeIds.join(', ')}.`),
    ],
  },
  {
    name: 'mudar_papel_de_parede',
    description: 'Muda o papel de parede do ambiente de trabalho.',
    risk: 'livre',
    parameters: [
      choice('papel', 'Variante do fundo.', ['nebulosa', 'grelha', 'particulas', 'liso']),
    ],
  },
  {
    name: 'mudar_estado_do_sistema',
    description:
      'Muda o modo do sistema. Afeta que avisos interrompem, as partículas do núcleo e o ritmo das métricas.',
    risk: 'livre',
    parameters: [choice('estado', 'Modo pretendido.', stateIds)],
  },

  // ── Widgets ───────────────────────────────────────────────────────────────
  {
    name: 'mostrar_widget',
    description: 'Mostra um widget na grelha do ambiente de trabalho.',
    risk: 'livre',
    parameters: [choice('widget', 'Qual o widget.', widgetIds)],
  },
  {
    name: 'esconder_widget',
    description: 'Esconde um widget. A posição fica guardada para quando voltar.',
    risk: 'livre',
    parameters: [choice('widget', 'Qual o widget.', widgetIds)],
  },

  // ── Desktops e layouts ────────────────────────────────────────────────────
  {
    name: 'mudar_de_desktop',
    description:
      'Salta para outro desktop. Cada um tem janelas, widgets, tema e papel de parede próprios.',
    risk: 'livre',
    parameters: [
      {
        name: 'desktop',
        type: 'number',
        description: `Número do desktop, de ${DESKTOP_IDS[0]} a ${DESKTOP_IDS.at(-1)}.`,
        required: true,
      },
    ],
  },
  {
    name: 'aplicar_layout',
    description:
      'Aplica um layout guardado: repõe janelas, widgets, tema e papel de parede de uma vez.',
    risk: 'livre',
    parameters: [text('layout', 'Nome ou identificador do layout.')],
  },
  {
    name: 'guardar_layout',
    description: 'Guarda o estado atual do ambiente de trabalho como um layout com nome.',
    risk: 'livre',
    parameters: [text('nome', 'Nome a dar ao layout.')],
  },

  // ── Tarefas ───────────────────────────────────────────────────────────────
  {
    name: 'criar_tarefa',
    description: 'Cria uma tarefa na lista.',
    risk: 'livre',
    parameters: [
      text('titulo', 'O que há a fazer.'),
      choice('prioridade', 'Urgência.', ['alta', 'media', 'baixa'], false),
      text(
        'prazo',
        'Prazo, em AAAA-MM-DD, resolvido a partir da data de hoje que já sabe (ex.: "amanhã" ' +
          'vira o dia seguinte, "sexta-feira" a próxima sexta). Omitido se o pedido não tiver prazo.',
        false,
      ),
    ],
  },
  {
    name: 'concluir_tarefa',
    description: 'Marca como concluída a tarefa cujo título mais se aproxima do texto dado.',
    risk: 'livre',
    parameters: [text('titulo', 'Título ou parte do título da tarefa.')],
  },
  {
    name: 'apagar_tarefas_concluidas',
    description: 'Apaga de vez todas as tarefas já concluídas.',
    risk: 'perde',
    parameters: [],
    confirmation: () => 'Apagar todas as tarefas concluídas. Não há como as recuperar.',
  },

  // ── Sistema ───────────────────────────────────────────────────────────────
  {
    name: 'notificar',
    description: 'Mostra uma notificação ao utilizador.',
    risk: 'livre',
    parameters: [text('titulo', 'Título curto.'), text('descricao', 'Uma linha de detalhe.')],
  },
  {
    name: 'pesquisar',
    description: 'Abre a pesquisa global já com um termo escrito.',
    risk: 'livre',
    parameters: [text('termo', 'O que procurar.')],
  },
  {
    name: 'controlar_musica',
    description: 'Comanda a reprodução de música.',
    risk: 'livre',
    parameters: [
      choice('acao', 'O que fazer.', ['tocar', 'pausar', 'proxima', 'anterior']),
    ],
  },
  {
    name: 'ler_em_voz_alta',
    description: 'Diz um texto em voz alta pelo sintetizador do sistema.',
    risk: 'livre',
    parameters: [text('texto', 'O que dizer.')],
  },

  // ── Automações ────────────────────────────────────────────────────────────
  {
    name: 'ligar_automacao',
    description: 'Liga ou desliga uma automação existente.',
    risk: 'livre',
    parameters: [
      text('nome', 'Nome da automação.'),
      { name: 'ligada', type: 'boolean', description: 'Ligar ou desligar.', required: true },
    ],
  },
  {
    name: 'executar_automacao',
    description: 'Corre uma automação agora, sem esperar pelo gatilho.',
    risk: 'livre',
    parameters: [text('nome', 'Nome da automação.')],
  },

  // ── Destrutivas ───────────────────────────────────────────────────────────
  {
    name: 'apagar_conversas',
    description: 'Apaga todo o histórico de conversas do assistente, incluindo as fixadas.',
    risk: 'perde',
    parameters: [],
    confirmation: () => 'Apagar todas as conversas guardadas, incluindo as fixadas.',
  },
  {
    name: 'esquecer_memoria',
    description: 'Apaga o que o assistente guardou sobre quem o usa.',
    risk: 'perde',
    parameters: [],
    confirmation: () => 'Esquecer tudo o que sei sobre si: preferências e últimos pedidos.',
  },
  {
    name: 'repor_widgets',
    description: 'Devolve a grelha de widgets ao arranjo predefinido.',
    risk: 'perde',
    parameters: [],
    confirmation: () => 'Repor o arranjo predefinido. O que arrumou à mão perde-se.',
  },
];

export function getTool(name: string): ToolDefinition | null {
  return TOOLS.find((tool) => tool.name === name) ?? null;
}

/** As que perdem dados. Curta de propósito. */
export const DESTRUCTIVE_TOOLS: readonly string[] = TOOLS.filter(
  (tool) => tool.risk === 'perde',
).map((tool) => tool.name);

/**
 * O catálogo no formato que a API espera (o mesmo da OpenAI).
 *
 * Convertido a partir da definição em vez de escrito duas vezes: duas cópias
 * divergiriam à primeira ferramenta nova.
 */
export function toolsAsJsonSchema(): readonly unknown[] {
  return TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map((parameter) => [
            parameter.name,
            {
              type: parameter.type,
              description: parameter.description,
              ...(parameter.options ? { enum: parameter.options } : {}),
            },
          ]),
        ),
        required: tool.parameters.filter((parameter) => parameter.required).map((p) => p.name),
      },
    },
  }));
}

/**
 * Valida os argumentos que o modelo mandou.
 *
 * Devolve o que está errado, ou `null` se estiver tudo bem. Um modelo engana-se
 * — manda um tema que não existe, esquece um campo — e isso não pode chegar ao
 * executor: dava um erro de tipo em produção em vez de uma frase a explicar.
 */
export function validateArgs(
  tool: ToolDefinition,
  args: Readonly<Record<string, unknown>>,
): string | null {
  for (const parameter of tool.parameters) {
    const value = args[parameter.name];

    if (value === undefined || value === null || value === '') {
      if (parameter.required) return `Falta o argumento "${parameter.name}".`;
      continue;
    }

    // O tipo verifica-se antes de tudo o resto. Um modelo que mande um objeto
    // onde se espera texto não pode ser convertido — daria "[object Object]"
    // no executor, e uma ação com um argumento absurdo.
    if (parameter.type === 'number' && typeof value !== 'number') {
      return `"${parameter.name}" tem de ser um número.`;
    }

    if (parameter.type === 'boolean' && typeof value !== 'boolean') {
      return `"${parameter.name}" tem de ser verdadeiro ou falso.`;
    }

    if (parameter.type === 'string') {
      if (typeof value !== 'string') return `"${parameter.name}" tem de ser texto.`;

      if (parameter.options && !parameter.options.includes(value)) {
        return `"${value}" não é um valor válido para "${parameter.name}".`;
      }
    }
  }

  return null;
}
