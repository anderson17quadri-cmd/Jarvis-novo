import { normalizeSearch } from '@/utils/text';
import { DEEPSEEK_MODELS, type DeepSeekModelId } from '@/types/ai-provider-settings';

/**
 * Escolher o modelo pela tarefa (Parte 12 §Seleção automática).
 *
 * A DeepSeek tem dois modelos com preços e tempos muito diferentes: o `chat`
 * responde depressa e barato, o `reasoner` pensa antes de responder e custa
 * mais. Quem escolhe à mão acaba a deixar um dos dois ligado para tudo — o
 * caro, e paga a pensar em conversa de circunstância; ou o barato, e recebe
 * respostas fracas quando o problema era a sério.
 *
 * Isto **não é um classificador aprendido**, e não finge ser. É o mesmo tipo
 * de regra dos comandos de voz: normalizar sem acentos, procurar palavras que
 * denunciam a tarefa. Erra, e por isso a escolha aparece na resposta e
 * desliga-se num interruptor.
 */

/** Porque é que se escolheu o que se escolheu. Vai à interface tal e qual. */
export type ModelReason = 'raciocinio' | 'codigo' | 'longo' | 'conversa' | 'fixo';

export const MODEL_REASONS: Record<ModelReason, string> = {
  raciocinio: 'a pergunta pede raciocínio',
  codigo: 'a pergunta é sobre código',
  longo: 'o pedido é longo',
  conversa: 'chega para conversa',
  fixo: 'escolhido por si',
};

export interface ModelChoice {
  readonly model: DeepSeekModelId;
  readonly reason: ModelReason;
}

/**
 * Palavras que pedem para pensar.
 *
 * Sem acentos, porque a comparação é feita sobre texto normalizado. "porque"
 * apanha "porque" e "porquê"; é de propósito.
 */
const REASONING_WORDS: readonly string[] = [
  'porque',
  'explica',
  'explique',
  'compara',
  'compare',
  'analisa',
  'analise',
  'demonstra',
  'prova que',
  'calcula',
  'resolve',
  'planeia',
  'passo a passo',
  'estrategia',
  'pros e contras',
  'vantagens e desvantagens',
  'qual a diferenca',
  'qual e a diferenca',
  'otimiza',
  'como e que',
  'justifica',
];

const CODE_WORDS: readonly string[] = [
  'codigo',
  'funcao',
  'algoritmo',
  'refatora',
  'typescript',
  'javascript',
  'python',
  'rust',
  'sql',
  'regex',
  'stack trace',
  'compila',
  'este erro',
  'este bug',
  'corrige o',
];

/**
 * A partir de quantos caracteres um pedido conta como longo.
 *
 * Não é sobre o número em si: um pedido com muitas linhas costuma trazer
 * requisitos, e responder-lhe bem exige segurar tudo ao mesmo tempo.
 */
export const LONG_PROMPT_CHARS = 400;

/** O modelo que pensa. Lido da tabela, para não haver dois sítios com o nome. */
const REASONER: DeepSeekModelId = 'deepseek-reasoner';
const CHAT: DeepSeekModelId = 'deepseek-chat';

/**
 * Escolhe o modelo para um pedido.
 *
 * Com `isAuto` desligado devolve o que a pessoa escolheu, e diz que foi ela —
 * a interface mostra o mesmo rótulo nos dois casos, e a diferença tem de estar
 * escrita algures.
 */
export function chooseModel(
  prompt: string,
  preferred: DeepSeekModelId,
  isAuto: boolean,
): ModelChoice {
  if (!isAuto) return { model: preferred, reason: 'fixo' };

  const text = normalizeSearch(prompt);

  // Um bloco de código no pedido não precisa de palavra nenhuma para se
  // denunciar. Verifica-se no texto original: as crases não sobrevivem à
  // normalização de forma garantida.
  if (prompt.includes('```')) return { model: REASONER, reason: 'codigo' };

  if (CODE_WORDS.some((word) => text.includes(word))) {
    return { model: REASONER, reason: 'codigo' };
  }

  if (REASONING_WORDS.some((word) => text.includes(word))) {
    return { model: REASONER, reason: 'raciocinio' };
  }

  if (prompt.length > LONG_PROMPT_CHARS) return { model: REASONER, reason: 'longo' };

  return { model: CHAT, reason: 'conversa' };
}

/** O nome do modelo como aparece à pessoa. */
export function modelName(model: DeepSeekModelId): string {
  return DEEPSEEK_MODELS.find((entry) => entry.id === model)?.name ?? model;
}

/** A etiqueta que fica na resposta: "Reasoner · a pergunta pede raciocínio". */
export function describeChoice(choice: ModelChoice): string {
  return `${modelName(choice.model)} · ${MODEL_REASONS[choice.reason]}`;
}
