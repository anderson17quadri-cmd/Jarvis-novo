import { appTitle, stateName, themeName, widgetName } from '@/lib/names';
import { EVENT_LABELS, type SystemEventName } from '@/services/event-bus';
import type { AppId } from './app';
import type { SystemStateId } from './system-state';
import type { WidgetId } from './widget';
import type { ThemeId } from '@/design-system/tokens';

/**
 * Automações (Parte 13).
 *
 * `Gatilho → Condições → Ações`, exatamente como a spec descreve.
 *
 * Só entram gatilhos e ações que o sistema sabe mesmo cumprir dentro do
 * browser: horas, eventos internos, abrir janelas, notificar, mudar tema.
 * Ficheiros, USB, bateria e rede exigem o nativo e ficam registados como
 * bloqueados no `SPEC.md` — uma automação que nunca dispara é pior do que uma
 * automação que não existe.
 */

// ── Gatilhos ───────────────────────────────────────────────────────────────

/** Todos os dias à hora marcada. */
export interface TimeTrigger {
  readonly kind: 'hora';
  /** 0–23, hora local. */
  readonly hour: number;
  /** 0–59. */
  readonly minute: number;
}

/** De N em N minutos, enquanto a aplicação estiver aberta. */
export interface IntervalTrigger {
  readonly kind: 'intervalo';
  readonly everyMinutes: number;
}

/** Quando acontece um facto do sistema. */
export interface EventTrigger {
  readonly kind: 'evento';
  readonly event: SystemEventName;
}

/** Só quando o utilizador carregar em "Executar". */
export interface ManualTrigger {
  readonly kind: 'manual';
}

/** Quando um ficheiro muda numa pasta observada (nativo). */
export interface FileTrigger {
  readonly kind: 'ficheiros';
  /** Caminho absoluto da pasta a observar. */
  readonly folderPath: string;
}

/** Quando um dispositivo USB é ligado ou desligado (nativo). */
export interface UsbTrigger {
  readonly kind: 'usb';
  readonly action: 'ligado' | 'desligado';
}

/** Quando a bateria cruza um limiar (nativo). */
export interface BatteryTrigger {
  readonly kind: 'bateria';
  readonly direction: 'abaixo' | 'acima';
  /** Percentagem (0–100). */
  readonly percent: number;
}

export type AutomationTrigger =
  | TimeTrigger
  | IntervalTrigger
  | EventTrigger
  | ManualTrigger
  | FileTrigger
  | UsbTrigger
  | BatteryTrigger;

// ── Condições ──────────────────────────────────────────────────────────────

/** Dias da semana em que a regra pode correr. 0 = domingo. */
export interface WeekdayCondition {
  readonly kind: 'dia-da-semana';
  readonly days: readonly number[];
}

/** Só dentro de uma faixa horária. */
export interface TimeRangeCondition {
  readonly kind: 'faixa-horaria';
  readonly fromHour: number;
  readonly toHour: number;
}

/** Só quando o sistema está num determinado estado. */
export interface SystemStateCondition {
  readonly kind: 'estado-sistema';
  readonly state: SystemStateId;
}

export type AutomationCondition = WeekdayCondition | TimeRangeCondition | SystemStateCondition;

// ── Ações ──────────────────────────────────────────────────────────────────

export interface OpenWindowAction {
  readonly kind: 'abrir-janela';
  readonly appId: AppId;
}

export interface NotifyAction {
  readonly kind: 'notificar';
  readonly title: string;
  readonly description: string;
}

export interface ThemeAction {
  readonly kind: 'tema';
  readonly theme: ThemeId;
}

export interface SystemStateAction {
  readonly kind: 'estado-sistema';
  readonly state: SystemStateId;
}

export interface WidgetAction {
  readonly kind: 'widget';
  readonly widget: WidgetId;
  readonly show: boolean;
}

export interface SpeakAction {
  readonly kind: 'falar';
  readonly text: string;
}

export type AutomationAction =
  | OpenWindowAction
  | NotifyAction
  | ThemeAction
  | SystemStateAction
  | WidgetAction
  | SpeakAction;

// ── Automação ──────────────────────────────────────────────────────────────

export interface Automation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: AutomationTrigger;
  readonly conditions: readonly AutomationCondition[];
  readonly actions: readonly AutomationAction[];
  readonly isEnabled: boolean;
  readonly createdAt: number;
  readonly lastRunAt: number | null;
  readonly runCount: number;
}

export type RunResult = 'ok' | 'condicoes-nao-cumpridas' | 'erro';

export interface AutomationRun {
  readonly id: string;
  readonly automationId: string;
  readonly automationName: string;
  readonly at: number;
  readonly result: RunResult;
  readonly durationMs: number;
  /** O que correu, ou porque não correu. */
  readonly message: string;
}

/** Quantas execuções o histórico guarda. */
export const RUN_HISTORY_LIMIT = 60;

// ── Etiquetas ──────────────────────────────────────────────────────────────

export const WEEKDAY_LABELS: readonly string[] = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export const RESULT_LABELS: Record<RunResult, string> = {
  ok: 'Executada',
  'condicoes-nao-cumpridas': 'Condições por cumprir',
  erro: 'Falhou',
};

/** Descreve um gatilho em português, para a lista não mostrar JSON. */
export function describeTrigger(trigger: AutomationTrigger): string {
  switch (trigger.kind) {
    case 'hora':
      return `Todos os dias às ${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`;
    case 'intervalo':
      return `De ${trigger.everyMinutes} em ${trigger.everyMinutes} minutos`;
    case 'evento':
      return `Ao ${EVENT_LABELS[trigger.event].toLowerCase()}`;
    case 'manual':
      return 'Só quando pedir';
    case 'ficheiros':
      return `Quando algo muda em ${trigger.folderPath}`;
    case 'usb':
      return `Quando um dispositivo é ${trigger.action}`;
    case 'bateria':
      return `Quando a bateria ${trigger.direction === 'abaixo' ? 'desce abaixo' : 'sobe acima'} de ${trigger.percent}%`;
  }
}

/**
 * Descreve uma ação em português.
 *
 * Nomes, não identificadores — a mesma regra dos comandos de voz (ver
 * `lib/names.ts`). Os cinco exemplos que vêm com o sistema usam identificadores
 * a sério (`oled`, `economia`, `news`…), e sem isto "Modo noite" mostrava-se
 * como "Aplicar o tema oled · Passar ao modo economia" na própria janela de
 * automações — o defeito que a voz já tinha tido.
 */
export function describeAction(action: AutomationAction): string {
  switch (action.kind) {
    case 'abrir-janela':
      return `Abrir a janela ${appTitle(action.appId)}`;
    case 'notificar':
      return `Avisar: "${action.title}"`;
    case 'tema':
      return `Aplicar o tema ${themeName(action.theme)}`;
    case 'estado-sistema':
      return `Passar ao modo ${stateName(action.state)}`;
    case 'widget':
      return `${action.show ? 'Mostrar' : 'Esconder'} o widget ${widgetName(action.widget)}`;
    case 'falar':
      return `Dizer em voz alta: "${action.text}"`;
  }
}

/** Descreve uma condição em português. */
export function describeCondition(condition: AutomationCondition): string {
  switch (condition.kind) {
    case 'dia-da-semana':
      return `Só ${condition.days.map((day) => WEEKDAY_LABELS[day] ?? '?').join(', ')}`;
    case 'faixa-horaria':
      return `Só entre as ${condition.fromHour}h e as ${condition.toHour}h`;
    case 'estado-sistema':
      return `Só no modo ${stateName(condition.state)}`;
  }
}
