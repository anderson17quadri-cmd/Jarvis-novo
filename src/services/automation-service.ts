import { createId } from '@/lib/id';
import { eventBus, type SystemEventName } from './event-bus';
import { storageService, STORAGE_KEYS } from './storage-service';
import {
  RUN_HISTORY_LIMIT,
  type Automation,
  type AutomationAction,
  type AutomationCondition,
  type AutomationRun,
  type RunResult,
} from '@/types/automation';

/**
 * Motor de automações (Parte 13).
 *
 * `Gatilho → Condições → Ações`. Escuta o Event Bus, tem um relógio próprio
 * para os gatilhos horários, avalia condições e executa ações — registando
 * tudo no histórico.
 *
 * **Não sabe executar nada.** As ações são cumpridas por um executor injetado
 * de fora, como a Command Palette faz com as suas. Sem isso, o motor acabaria
 * a conhecer o WindowManager, o serviço de temas e o de voz, e testá-lo exigia
 * montar o sistema inteiro.
 *
 * O que **não** está aqui, por não haver forma honesta de o fazer no browser:
 * gatilhos de ficheiros, USB, bateria e rede. Ficam registados no `SPEC.md`.
 */

/** Quem sabe cumprir as ações. Fornecido pela aplicação. */
export interface AutomationExecutor {
  readonly openWindow: (appId: string) => void;
  readonly notify: (title: string, description: string) => void;
  readonly setTheme: (theme: string) => void;
  readonly setSystemState: (state: string) => void;
  readonly setWidgetVisible: (widget: string, show: boolean) => void;
  readonly speak: (text: string) => void;
}

/** O que o motor precisa de saber sobre o presente para avaliar condições. */
export interface AutomationContext {
  readonly now: Date;
  readonly systemState: string;
}

/** Quantas vezes por minuto o relógio verifica os gatilhos horários. */
const TICK_MS = 20_000;

export class AutomationService {
  private automations: readonly Automation[] = [];
  private runs: readonly AutomationRun[] = [];
  private executor: AutomationExecutor | null = null;
  private context: () => AutomationContext = () => ({ now: new Date(), systemState: 'normal' });

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly unsubscribers: (() => void)[] = [];
  private readonly listeners = new Set<() => void>();

  /**
   * Marcas do último disparo, por automação.
   *
   * Um gatilho horário é verificado várias vezes por minuto; sem isto, uma
   * regra das 08:00 corria três vezes seguidas às 08:00.
   */
  private readonly lastFired = new Map<string, number>();

  get list(): readonly Automation[] {
    return this.automations;
  }

  get history(): readonly AutomationRun[] {
    return this.runs;
  }

  /** Avisa a interface de que algo mudou. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Arranque ─────────────────────────────────────────────────────────────

  /**
   * Põe o motor a correr.
   *
   * Devolve a função que o pára — chamar duas vezes sem parar não duplica
   * temporizadores, porque `start` limpa o que estava antes.
   */
  start(executor: AutomationExecutor, context: () => AutomationContext): () => void {
    this.stop();
    this.executor = executor;
    this.context = context;

    for (const event of this.subscribedEvents()) {
      this.unsubscribers.push(
        eventBus.on(event, () => {
          this.runByTrigger((automation) =>
            automation.trigger.kind === 'evento' && automation.trigger.event === event,
          );
        }),
      );
    }

    this.timer = setInterval(() => this.tick(), TICK_MS);
    // Uma passagem imediata: sem isto, uma regra por intervalo só corria ao fim
    // do primeiro tique.
    this.tick();

    return () => this.stop();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;

    for (const off of this.unsubscribers.splice(0)) off();
    this.executor = null;
  }

  // ── Gestão ───────────────────────────────────────────────────────────────

  add(automation: Omit<Automation, 'id' | 'createdAt' | 'lastRunAt' | 'runCount'>): Automation {
    const created: Automation = {
      ...automation,
      id: createId('auto'),
      createdAt: Date.now(),
      lastRunAt: null,
      runCount: 0,
    };

    this.automations = [created, ...this.automations];
    this.emit();
    void this.persist();
    return created;
  }

  remove(id: string): void {
    this.automations = this.automations.filter((automation) => automation.id !== id);
    this.lastFired.delete(id);
    this.emit();
    void this.persist();
  }

  setEnabled(id: string, isEnabled: boolean): void {
    this.automations = this.automations.map((automation) =>
      automation.id === id ? { ...automation, isEnabled } : automation,
    );
    this.emit();
    void this.persist();
  }

  clearHistory(): void {
    this.runs = [];
    this.emit();
    void this.persist();
  }

  // ── Execução ─────────────────────────────────────────────────────────────

  /**
   * Corre uma automação agora.
   *
   * `force` salta as condições — é o que o botão "Executar" faz. Correr uma
   * regra à mão e ela não fazer nada por ser terça-feira seria confuso.
   */
  run(id: string, force = false): AutomationRun | null {
    const automation = this.automations.find((candidate) => candidate.id === id);
    if (!automation) return null;

    const startedAt = Date.now();
    const context = this.context();

    if (!force) {
      const failing = automation.conditions.find(
        (condition) => !matchesCondition(condition, context),
      );

      if (failing) {
        return this.record(automation, {
          result: 'condicoes-nao-cumpridas',
          durationMs: Date.now() - startedAt,
          message: describeUnmet(failing),
        });
      }
    }

    if (!this.executor) {
      return this.record(automation, {
        result: 'erro',
        durationMs: Date.now() - startedAt,
        message: 'O motor não está ligado a nenhum executor.',
      });
    }

    let done = 0;
    try {
      for (const action of automation.actions) {
        this.perform(action);
        done += 1;
      }
    } catch (error) {
      return this.record(automation, {
        result: 'erro',
        durationMs: Date.now() - startedAt,
        message: `Falhou na ação ${done + 1}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      });
    }

    return this.record(automation, {
      result: 'ok',
      durationMs: Date.now() - startedAt,
      message: `${done} ${done === 1 ? 'ação executada' : 'ações executadas'}`,
    });
  }

  // ── Persistência ─────────────────────────────────────────────────────────

  async persist(): Promise<void> {
    await storageService.set(STORAGE_KEYS.automations, {
      automations: this.automations,
      runs: this.runs,
    });
  }

  async hydrate(seed: readonly Automation[]): Promise<void> {
    const saved = await storageService.get<{
      automations: Automation[];
      runs: AutomationRun[];
    } | null>(STORAGE_KEYS.automations, null);

    // `null` distingue "nunca gravado" de "gravado vazio": quem apagou todas as
    // automações não as quer de volta ao reabrir.
    this.automations = saved?.automations ?? seed;
    this.runs = saved?.runs ?? [];
    this.emit();
  }

  // ── Interior ─────────────────────────────────────────────────────────────

  /** Só os eventos que alguma automação usa — não se escuta o que ninguém quer. */
  private subscribedEvents(): readonly SystemEventName[] {
    const events = new Set<SystemEventName>();

    for (const automation of this.automations) {
      if (automation.trigger.kind === 'evento') events.add(automation.trigger.event);
    }

    return [...events];
  }

  private tick(): void {
    const { now } = this.context();

    this.runByTrigger((automation) => {
      const trigger = automation.trigger;

      if (trigger.kind === 'hora') {
        if (now.getHours() !== trigger.hour || now.getMinutes() !== trigger.minute) return false;
        return !this.firedRecently(automation.id, 90_000);
      }

      if (trigger.kind === 'intervalo') {
        return !this.firedRecently(automation.id, trigger.everyMinutes * 60_000);
      }

      return false;
    });
  }

  private firedRecently(id: string, withinMs: number): boolean {
    const last = this.lastFired.get(id);
    return last !== undefined && Date.now() - last < withinMs;
  }

  private runByTrigger(predicate: (automation: Automation) => boolean): void {
    for (const automation of this.automations) {
      if (!automation.isEnabled) continue;
      if (!predicate(automation)) continue;

      this.lastFired.set(automation.id, Date.now());
      this.run(automation.id);
    }
  }

  private perform(action: AutomationAction): void {
    const executor = this.executor;
    if (!executor) throw new Error('Sem executor');

    switch (action.kind) {
      case 'abrir-janela':
        executor.openWindow(action.appId);
        return;
      case 'notificar':
        executor.notify(action.title, action.description);
        return;
      case 'tema':
        executor.setTheme(action.theme);
        return;
      case 'estado-sistema':
        executor.setSystemState(action.state);
        return;
      case 'widget':
        executor.setWidgetVisible(action.widget, action.show);
        return;
      case 'falar':
        executor.speak(action.text);
        return;
    }
  }

  private record(
    automation: Automation,
    outcome: { result: RunResult; durationMs: number; message: string },
  ): AutomationRun {
    const run: AutomationRun = {
      id: createId('run'),
      automationId: automation.id,
      automationName: automation.name,
      at: Date.now(),
      ...outcome,
    };

    this.runs = [run, ...this.runs].slice(0, RUN_HISTORY_LIMIT);

    // Só uma execução a sério conta para o contador — uma regra que não passou
    // nas condições não "correu".
    if (outcome.result === 'ok') {
      this.automations = this.automations.map((candidate) =>
        candidate.id === automation.id
          ? { ...candidate, lastRunAt: run.at, runCount: candidate.runCount + 1 }
          : candidate,
      );
    }

    this.emit();
    void this.persist();
    return run;
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** Avalia uma condição contra o presente. Pura, para se testar sozinha. */
export function matchesCondition(
  condition: AutomationCondition,
  context: AutomationContext,
): boolean {
  switch (condition.kind) {
    case 'dia-da-semana':
      return condition.days.includes(context.now.getDay());

    case 'faixa-horaria': {
      const hour = context.now.getHours();
      // Faixa que atravessa a meia-noite (22h → 6h) lê-se ao contrário.
      if (condition.fromHour <= condition.toHour) {
        return hour >= condition.fromHour && hour < condition.toHour;
      }
      return hour >= condition.fromHour || hour < condition.toHour;
    }

    case 'estado-sistema':
      return context.systemState === condition.state;
  }
}

function describeUnmet(condition: AutomationCondition): string {
  switch (condition.kind) {
    case 'dia-da-semana':
      return 'Hoje não é um dos dias da regra.';
    case 'faixa-horaria':
      return 'Fora da faixa horária da regra.';
    case 'estado-sistema':
      return `O sistema não está no modo ${condition.state}.`;
  }
}

export const automationService = new AutomationService();
