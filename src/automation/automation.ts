/**
 * Fase 2 — Motor de automações.
 *
 * Só a interface. Um gatilho, condições e ações, para regras do género
 * "todos os dias às 08:00, resume os emails e cria as tarefas".
 */

export type TriggerKind = 'schedule' | 'event' | 'manual';

export interface ScheduleTrigger {
  readonly kind: 'schedule';
  /** Expressão cron, avaliada na hora local. */
  readonly cron: string;
}

export interface EventTrigger {
  readonly kind: 'event';
  /** Nome do evento do sistema, como `email:received`. */
  readonly event: string;
}

export interface ManualTrigger {
  readonly kind: 'manual';
}

export type AutomationTrigger = ScheduleTrigger | EventTrigger | ManualTrigger;

export interface AutomationAction {
  readonly id: string;
  readonly type: string;
  readonly params: Record<string, unknown>;
}

export interface Automation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: AutomationTrigger;
  readonly actions: readonly AutomationAction[];
  readonly enabled: boolean;
  readonly lastRunAt: number | null;
}

export interface AutomationRun {
  readonly automationId: string;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly status: 'running' | 'succeeded' | 'failed';
  readonly error: string | null;
}

export interface AutomationEngine {
  list(): readonly Automation[];
  create(automation: Omit<Automation, 'id' | 'lastRunAt'>): Promise<Automation>;
  update(id: string, changes: Partial<Automation>): Promise<Automation>;
  remove(id: string): Promise<void>;
  run(id: string): Promise<AutomationRun>;
  history(id: string): Promise<readonly AutomationRun[]>;
}
