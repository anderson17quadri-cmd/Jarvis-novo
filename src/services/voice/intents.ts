import { appTitle, stateName, themeName, widgetName } from '@/lib/names';
import { normalizeSearch } from '@/utils/text';
import { THEMES, type ThemeId } from '@/design-system/tokens';
import { ALL_WIDGETS } from '@/widgets/registry';
import { SYSTEM_STATES, type SystemStateId } from '@/types/system-state';
import type { AppId } from '@/types/app';
import type { WidgetId } from '@/types/widget';

/**
 * Interpretação de comandos de voz (Parte 10).
 *
 * Função pura: entra uma frase, saem intenções. Não abre janelas, não fala,
 * não toca em store nenhum — quem executa é o `useVoice`, com um executor
 * injetado. Assim isto testa-se com strings, sem montar nada.
 *
 * A spec pede que não se decorem comandos exatos. Não há aqui nenhum modelo de
 * linguagem — o que há é: normalizar sem acentos, procurar um verbo conhecido,
 * e aceitar as várias maneiras de dizer a mesma coisa. Chega para os comandos
 * da Parte 10 e não finge ser mais do que é.
 */

export type VoiceIntent =
  | { readonly kind: 'abrir-janela'; readonly appId: AppId }
  | { readonly kind: 'fechar-janelas' }
  | { readonly kind: 'tema'; readonly theme: ThemeId }
  | { readonly kind: 'estado'; readonly state: SystemStateId }
  | { readonly kind: 'widget'; readonly widget: WidgetId; readonly show: boolean }
  | { readonly kind: 'esconder-widgets' }
  | { readonly kind: 'mostrar-widgets' }
  | { readonly kind: 'criar-tarefa'; readonly title: string }
  | { readonly kind: 'pesquisar'; readonly query: string }
  | { readonly kind: 'musica'; readonly action: 'tocar' | 'pausar' | 'proxima' | 'anterior' }
  | { readonly kind: 'reiniciar-interface' }
  | { readonly kind: 'perguntar'; readonly text: string };

/**
 * Intenções que não se executam sem confirmação (Parte 10 §Confirmações).
 *
 * O critério é simples: dá para desfazer? Fechar as janelas todas e reiniciar
 * a interface não dão, e uma frase mal ouvida não pode custar o trabalho de
 * uma manhã.
 */
const CRITICAL: ReadonlySet<VoiceIntent['kind']> = new Set([
  'fechar-janelas',
  'reiniciar-interface',
]);

export function isCritical(intent: VoiceIntent): boolean {
  return CRITICAL.has(intent.kind);
}

/**
 * O que a interpretação devolve.
 *
 * Não há aqui uma lista de "pedaços que não percebi", e a ausência é
 * deliberada: o `splitCommands` só divide a frase quando **todos** os pedaços
 * dão comando, e caso contrário trata a frase inteira como um só. Não existe
 * portanto um estado em que uma parte casa e outra sobra — e um campo que
 * nunca tem nada dentro é interface a fingir que informa.
 *
 * A regra do `splitCommands` é o que faz "criar tarefa comprar leite e pão"
 * ser uma tarefa e não duas. É por isso que se mantém.
 */
export interface ParsedSpeech {
  /** A frase tal como foi ouvida. */
  readonly transcript: string;
  readonly intents: readonly VoiceIntent[];
}

// ── Dicionário ─────────────────────────────────────────────────────────────

/** Como se pede cada janela, além do próprio nome. */
const APP_WORDS: Partial<Record<AppId, readonly string[]>> = {
  assistant: ['assistente', 'jarvis', 'chat'],
  calendar: ['calendario', 'agenda', 'compromissos'],
  system: ['recursos', 'monitor', 'desempenho', 'sistema'],
  themes: ['personalizacao', 'configuracoes', 'definicoes', 'aparencia', 'temas'],
  plugins: ['plugins', 'loja', 'extensoes'],
  files: ['arquivos', 'ficheiros', 'explorador', 'pastas'],
  emails: ['emails', 'email', 'correio', 'caixa de entrada'],
  tasks: ['tarefas', 'afazeres', 'lista de tarefas'],
  projects: ['projetos'],
  automations: ['automacoes', 'regras', 'rotinas'],
  music: ['musica', 'reprodutor'],
  browser: ['navegador', 'browser', 'internet'],
  terminal: ['terminal', 'consola'],
};

/** Verbos que pedem para abrir algo. */
const OPEN_VERBS = [
  'abre',
  'abrir',
  'mostra',
  'mostrar',
  'ver',
  'vai para',
  'ir para',
  'entra em',
  'entra no',
  'entra na',
  'inicia',
  'iniciar',
  'quero abrir',
  'quero ver',
  'preciso de ver',
  'preciso ver',
];

/** Verbos que pedem para esconder. */
const HIDE_VERBS = [
  'esconde',
  'esconder',
  'fecha',
  'fechar',
  'tira',
  'oculta',
  'ocultar',
  'remove',
  'remover',
];

const MUSIC_WORDS: readonly { readonly words: readonly string[]; readonly action: 'tocar' | 'pausar' | 'proxima' | 'anterior' }[] = [
  { words: ['proxima faixa', 'proxima musica', 'a seguir', 'saltar', 'avanca a musica', 'avancar musica'], action: 'proxima' },
  { words: ['faixa anterior', 'musica anterior', 'anterior', 'voltar atras', 'recua a musica', 'recuar musica'], action: 'anterior' },
  { words: ['pausa', 'pausar', 'para a musica', 'parar musica', 'para de tocar'], action: 'pausar' },
  { words: ['toca', 'tocar', 'reproduz', 'reproduzir', 'poe musica', 'continua a musica', 'retoma a musica'], action: 'tocar' },
];

const SEARCH_VERBS = [
  'procura',
  'procurar',
  'pesquisa',
  'pesquisar',
  'encontra',
  'encontrar',
  'busca',
  'buscar',
  'quero encontrar',
];
const TASK_VERBS = [
  'cria uma tarefa',
  'criar tarefa',
  'criar uma tarefa',
  'nova tarefa',
  'adiciona uma tarefa',
  'adicionar tarefa',
  'lembra-me de',
  'lembrar-me de',
  // "anotar" antes de "anota": um é prefixo do outro, e o casamento abaixo é
  // por `startsWith`. Com "anota" primeiro, "Anotar comprar leite" casava no
  // "anota" e sobrava um "r" preso ao título da tarefa.
  'anotar',
  'anota',
];

// ── Interpretação ──────────────────────────────────────────────────────────

/**
 * Divide uma frase em comandos.
 *
 * Só divide se **todos** os pedaços derem intenção. "Cria uma tarefa comprar
 * pão e leite" tem um "e" que não separa comandos — dividir aí daria uma
 * tarefa chamada "comprar pão" e um comando perdido chamado "leite".
 */
function splitCommands(normalized: string): readonly string[] {
  // A vírgula não leva espaço antes: "abre os emails, mostra os projetos".
  // Com `\s+` à frente de tudo, esse caso nunca chegava a ser dividido.
  const parts = normalized
    .split(/\s*,\s*|\s+(?:e depois|depois|e)\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 2) return [normalized];
  if (parts.every((part) => matchIntent(part) !== null)) return parts;

  return [normalized];
}

/** Tira a pontuação do fim: "comprar cabo." não é uma tarefa diferente de "comprar cabo". */
function trimPunctuation(text: string): string {
  return text.replace(/[.!?;:,]+$/, '').trim();
}

/**
 * Prefixos de cortesia mais comuns antes de um pedido — "podes", "por
 * favor", "consegues". Sem isto, só "abre os emails" batia; "podes abrir
 * os emails" não reconhecia nada, e caía sempre para o assistente.
 */
const POLITENESS_PREFIXES = [
  'por favor',
  'se fazes favor',
  'se faz favor',
  'importas-te de',
  'importa-te de',
  'consegues',
  'conseguias',
  'podes',
  'pode',
];

function stripPoliteness(text: string): string {
  let resultado = text;
  let removeuAlgum = true;

  // Em ciclo: "podes por favor abrir" tem dois prefixos, um a seguir ao outro.
  while (removeuAlgum) {
    removeuAlgum = false;
    for (const prefixo of POLITENESS_PREFIXES) {
      if (resultado.startsWith(`${prefixo} `)) {
        resultado = resultado.slice(prefixo.length).trim();
        removeuAlgum = true;
      }
    }
  }

  return resultado;
}

export function parseSpeech(transcript: string): ParsedSpeech {
  const normalized = trimPunctuation(normalizeSearch(transcript));

  if (normalized.length === 0) {
    return { transcript, intents: [] };
  }

  const intents: VoiceIntent[] = [];

  for (const part of splitCommands(normalized)) {
    const intent = matchIntent(trimPunctuation(part));
    if (intent) intents.push(intent);
  }

  // Nada reconhecido: em vez de dizer "não percebi", passa-se ao assistente.
  // Perguntar alguma coisa é o comando mais natural de todos.
  if (intents.length === 0) {
    return { transcript, intents: [{ kind: 'perguntar', text: transcript }] };
  }

  return { transcript, intents };
}

/** Interpreta um comando só. `null` quando não reconhece. */
export function matchIntent(normalized: string): VoiceIntent | null {
  const text = stripPoliteness(trimPunctuation(normalized));
  if (text.length === 0) return null;

  // ── Sistema ──────────────────────────────────────────────────────────────
  if (/fecha(r)? (todas as |as )?janelas/.test(text) || /fecha(r)? tudo\b/.test(text)) {
    return { kind: 'fechar-janelas' };
  }
  if (/reinicia(r)? (a |o )?(interface|sistema|app|aplicacao|jarvis)/.test(text)) {
    return { kind: 'reiniciar-interface' };
  }

  // ── Estados do sistema ───────────────────────────────────────────────────
  const state = matchSystemState(text);
  if (state) return { kind: 'estado', state };

  // ── Temas ────────────────────────────────────────────────────────────────
  const theme = matchTheme(text);
  if (theme) return { kind: 'tema', theme };

  // ── Multimédia ───────────────────────────────────────────────────────────
  for (const entry of MUSIC_WORDS) {
    if (entry.words.some((word) => text.includes(word))) {
      return { kind: 'musica', action: entry.action };
    }
  }

  /*
   * ── Widgets ────────────────────────────────────────────────────────────
   *
   * Exigem a palavra "widget". Vários widgets têm o nome de uma janela —
   * Email, Música, Relógio — e sem esta regra "mostra os emails" acendia o
   * widget de Email em vez de abrir a caixa de entrada. Entre as duas
   * leituras, a janela é sempre a mais provável.
   */
  if (text.includes('widget')) {
    if (HIDE_VERBS.some((verb) => text.startsWith(verb)) && /widgets\b/.test(text)) {
      return { kind: 'esconder-widgets' };
    }

    const widget = matchWidget(text);
    if (widget) {
      const hiding = HIDE_VERBS.some((verb) => text.startsWith(verb));
      return { kind: 'widget', widget, show: !hiding };
    }

    // "Widgets" sem nome nenhum: o verbo é que decide. Sem esta distinção,
    // "mostra os widgets" devolvia `esconder-widgets` e fazia-os desaparecer
    // todos — o contrário do que foi pedido, e sem confirmação, porque
    // esconder widgets não está no conjunto CRITICAL.
    if (/widgets\b/.test(text)) {
      return HIDE_VERBS.some((verb) => text.startsWith(verb))
        ? { kind: 'esconder-widgets' }
        : { kind: 'mostrar-widgets' };
    }
  }

  // ── Produtividade ────────────────────────────────────────────────────────
  for (const verb of TASK_VERBS) {
    if (text.startsWith(verb)) {
      const title = trimPunctuation(text.slice(verb.length));
      // "Cria uma tarefa" sem dizer qual abre a janela, que é o passo seguinte
      // óbvio — inventar um título vazio não ajudava ninguém.
      if (title.length === 0) return { kind: 'abrir-janela', appId: 'tasks' };
      return { kind: 'criar-tarefa', title };
    }
  }

  // ── Pesquisa ─────────────────────────────────────────────────────────────
  for (const verb of SEARCH_VERBS) {
    if (text.startsWith(`${verb} `)) {
      const query = trimPunctuation(
        text.slice(verb.length).replace(/^\s*(por|o|a|os|as|pelo|pela)\s+/, ''),
      );
      if (query.length > 0) return { kind: 'pesquisar', query };
    }
  }

  // ── Aplicações ───────────────────────────────────────────────────────────
  const appId = matchApp(text);
  if (appId) return { kind: 'abrir-janela', appId };

  return null;
}

function matchSystemState(text: string): SystemStateId | null {
  if (!/(modo|estado)/.test(text)) return null;

  for (const state of Object.values(SYSTEM_STATES)) {
    if (text.includes(normalizeSearch(state.name))) return state.id;
  }
  return null;
}

function matchTheme(text: string): ThemeId | null {
  if (!text.includes('tema')) return null;

  for (const theme of THEMES) {
    // O nome completo primeiro: "JARVIS Classic" antes de "classic".
    if (text.includes(normalizeSearch(theme.name))) return theme.id;
  }

  for (const theme of THEMES) {
    if (text.includes(normalizeSearch(theme.id.replace('-', ' ')))) return theme.id;
  }
  return null;
}

function matchWidget(text: string): WidgetId | null {
  for (const widget of ALL_WIDGETS) {
    if (text.includes(normalizeSearch(widget.name))) return widget.id;
  }
  return null;
}

function matchApp(text: string): AppId | null {
  const asksToOpen = OPEN_VERBS.some((verb) => text.startsWith(verb));

  for (const [appId, words] of Object.entries(APP_WORDS) as [AppId, readonly string[]][]) {
    for (const word of words) {
      if (!text.includes(word)) continue;
      // Sem verbo, só se a frase for praticamente o nome: "calendário" abre,
      // "o que tenho no calendário" é uma pergunta para o assistente.
      if (asksToOpen || text.length <= word.length + 4) return appId;
    }
  }

  return null;
}

// ── Descrição ──────────────────────────────────────────────────────────────

/**
 * Descreve uma intenção em português, para a confirmação e o histórico.
 *
 * Nomes, não identificadores. "Abrir emails" e "o widget cpu" eram o nome
 * interno a escapar-se para o ecrã — passa despercebido numa notificação de
 * dois segundos, mas a caixa de correção mostra isto enquanto se escreve, e aí
 * uma linha em minúsculas sem acentos denuncia-se.
 */
export function describeIntent(intent: VoiceIntent): string {
  switch (intent.kind) {
    case 'abrir-janela':
      return `Abrir ${appTitle(intent.appId)}`;
    case 'fechar-janelas':
      return 'Fechar todas as janelas';
    case 'tema':
      return `Aplicar o tema ${themeName(intent.theme)}`;
    case 'estado':
      return `Passar ao modo ${stateName(intent.state)}`;
    case 'widget':
      return `${intent.show ? 'Mostrar' : 'Esconder'} o widget ${widgetName(intent.widget)}`;
    case 'esconder-widgets':
      return 'Esconder os widgets';
    case 'mostrar-widgets':
      return 'Mostrar os widgets';
    case 'criar-tarefa':
      return `Criar a tarefa "${intent.title}"`;
    case 'pesquisar':
      return `Procurar "${intent.query}"`;
    case 'musica':
      return `Música: ${intent.action}`;
    case 'reiniciar-interface':
      return 'Reiniciar a interface';
    case 'perguntar':
      return 'Perguntar ao assistente';
  }
}
