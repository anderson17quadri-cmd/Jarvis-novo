import type { Task } from '@/types/task';
import type { ToolCall } from './tool-runner';

/**
 * Modo copiloto (Parte 11 §Sugestões discretas).
 *
 * A regra que governa este ficheiro está escrita para se poder cobrar dela:
 * **uma sugestão parte de um facto medido e propõe uma ação que já existe.**
 *
 * O widget de IA dizia, por escrito, que não mostrava sugestões — porque sem
 * modelo de linguagem seriam frases inventadas a fingir de inteligência. Isso
 * continua verdade, e é por isso que aqui não há nenhuma frase de encorajamento
 * nem nenhum "reparei que…". Há contagens, e o que fazer com elas.
 *
 * O que ficou de fora, e porquê:
 *
 * - **Notificações e emails por ler.** O facto é real, mas já está no ecrã, com
 *   número, a um clique. Uma sugestão que repete o que se vê é ruído.
 * - **Estado do sistema pela carga do processador.** No browser as métricas são
 *   simuladas, e uma sugestão tirada de um número inventado seria uma sugestão
 *   inventada com um passo pelo meio.
 * - **Hora tardia.** Não existe estado "noite" para propor, e o tema já é
 *   escuro. Não havia ação a oferecer.
 *
 * Três regras verdadeiras valem mais do que oito de encher.
 */

export interface CopilotFacts {
  readonly openWindows: number;
  readonly systemState: string;
  /** Tarefas por fazer cujo prazo já passou. */
  readonly overdueTasks: number;
  /** Tarefas por fazer com prazo para hoje. */
  readonly tasksDueToday: number;
}

/**
 * Conta as tarefas atrasadas e as de hoje.
 *
 * "Hoje" é o dia do calendário de quem está a ver, e não vinte e quatro horas:
 * uma tarefa para as 23h de hoje e outra para as 2h de amanhã não são a mesma
 * urgência, por mais próximas que estejam no relógio.
 */
export function countTasks(
  tasks: readonly Task[],
  now: Date,
): { readonly overdueTasks: number; readonly tasksDueToday: number } {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let overdueTasks = 0;
  let tasksDueToday = 0;

  for (const task of tasks) {
    if (task.isDone || task.dueAt === null) continue;

    if (task.dueAt < now.getTime()) overdueTasks += 1;
    else if (task.dueAt <= endOfToday.getTime()) tasksDueToday += 1;
  }

  return { overdueTasks, tasksDueToday };
}

export interface Suggestion {
  /**
   * Estável entre leituras.
   *
   * É o que permite dispensar uma sugestão sem ela voltar no segundo seguinte,
   * e o que impede a mesma sugestão de aparecer duas vezes com números
   * diferentes.
   */
  readonly id: string;
  /** O que se mediu. Sempre uma contagem, nunca uma impressão. */
  readonly fact: string;
  /** O que se propõe fazer. */
  readonly label: string;
  /** Executada pelo `runTool`, como qualquer ferramenta do assistente. */
  readonly call: ToolCall;
}

/** A partir de quantas janelas abertas vale a pena propor o modo foco. */
export const CROWDED_WINDOWS = 5;

/**
 * As sugestões que os factos justificam, da mais urgente à menos.
 *
 * Função pura: entram números, saem sugestões. Não lê stores, não vê horas,
 * não executa nada.
 */
export function suggest(facts: CopilotFacts): readonly Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (facts.overdueTasks > 0) {
    suggestions.push({
      id: 'tarefas-atrasadas',
      fact:
        facts.overdueTasks === 1
          ? 'Uma tarefa passou do prazo.'
          : `${facts.overdueTasks} tarefas passaram do prazo.`,
      label: 'Abrir as Tarefas',
      call: { id: 'copiloto-tarefas', name: 'abrir_janela', args: { app: 'tasks' } },
    });
  } else if (facts.tasksDueToday > 0) {
    // Só quando não há atrasadas: duas linhas sobre tarefas ao mesmo tempo
    // seriam a mesma sugestão dita de duas maneiras.
    suggestions.push({
      id: 'tarefas-hoje',
      fact:
        facts.tasksDueToday === 1
          ? 'Uma tarefa tem prazo hoje.'
          : `${facts.tasksDueToday} tarefas têm prazo hoje.`,
      label: 'Abrir as Tarefas',
      call: { id: 'copiloto-tarefas', name: 'abrir_janela', args: { app: 'tasks' } },
    });
  }

  if (facts.openWindows >= CROWDED_WINDOWS && facts.systemState === 'normal') {
    suggestions.push({
      id: 'muitas-janelas',
      fact: `${facts.openWindows} janelas abertas.`,
      label: 'Passar ao modo Foco',
      call: { id: 'copiloto-foco', name: 'mudar_estado_do_sistema', args: { estado: 'foco' } },
    });
  }

  return suggestions;
}

/**
 * Sugestões dispensadas nesta sessão.
 *
 * Guardadas num array imutável, e não num `Set`: assim `dismissedIds` devolve
 * sempre a mesma referência enquanto nada mudar, e serve de instantâneo a um
 * `useSyncExternalStore` sem o pôr a redesenhar em ciclo.
 *
 * Não persiste. Um facto que continue verdadeiro amanhã merece ser dito outra
 * vez; o que não pode é voltar no segundo a seguir a ser dispensado.
 */
let dismissed: readonly string[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * As sugestões que sobram depois de tirar as dispensadas.
 *
 * Recebe as dispensadas em vez de as ir buscar: quem chama de dentro do React
 * passa o instantâneo que já tem, e a filtragem passa a depender mesmo daquilo
 * de que depende. Sem isto, era preciso pôr uma dependência a mais num
 * `useMemo` só para o obrigar a recalcular — e o ESLint tinha razão em chamar
 * a isso uma dependência desnecessária.
 */
export function visibleSuggestions(
  facts: CopilotFacts,
  dismissedIds: readonly string[],
): readonly Suggestion[] {
  return suggest(facts).filter((suggestion) => !dismissedIds.includes(suggestion.id));
}

export const copilot = {
  visible(facts: CopilotFacts): readonly Suggestion[] {
    return visibleSuggestions(facts, dismissed);
  },

  dismiss(id: string): void {
    if (dismissed.includes(id)) return;
    dismissed = [...dismissed, id];
    notify();
  },

  /** Usado pelos testes, e por quem quiser voltar a ver o que dispensou. */
  reset(): void {
    if (dismissed.length === 0) return;
    dismissed = [];
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  get dismissedIds(): readonly string[] {
    return dismissed;
  },
};
