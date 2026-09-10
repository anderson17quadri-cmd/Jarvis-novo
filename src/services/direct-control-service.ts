/**
 * Serviço de controlo direto — Fase 3.1.
 *
 * Gere a sessão de controlo direto (palavra-passe, 30 minutos), o overlay de
 * confirmação, as ações simuladas e o registo de auditoria.
 *
 * Nenhuma dependência nativa — esta sub-fase é a única que não precisa do Rust
 * (ver `docs/spec/fase-3-controlo-direto.md` §5).
 */

import { logService } from '@/services/log-service';

// ── Tipos ──────────────────────────────────────────────────────────────────

/** Nível de risco de uma ação de controlo direto. */
export type RiskLevel = 'baixo' | 'medio' | 'alto' | 'irreversivel';

export const RISK_LABELS: Record<RiskLevel, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  irreversivel: 'Irreversível',
};

/** Um passo de controlo direto — o que se vai fazer, com que risco. */
export interface ControlStep {
  readonly id: string;
  /** Descrição legível — "Abrir o Explorador de Ficheiros", "Guardar o documento". */
  readonly description: string;
  readonly risk: RiskLevel;
  /** Que ação executar. Se `simulado`, não executa — só mostra. */
  readonly execute: () => void;
}

/** O que aconteceu num passo. */
export interface StepRecord {
  readonly id: string;
  readonly description: string;
  readonly risk: RiskLevel;
  readonly at: number;
  readonly wasSimulated: boolean;
  readonly wasConfirmed: boolean;
}

// ── Serviço ────────────────────────────────────────────────────────────────

type Listener = () => void;

class DirectControlService {
  // Estado
  private enabled = false;
  private passwordHash: string | null = null;
  private sessionExpiresAt: number | null = null;
  private simulatedMode = true;
  private steps: readonly StepRecord[] = [];
  private readonly listeners = new Set<Listener>();

  // ── Ativação ──────────────────────────────────────────────────────────

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.sessionExpiresAt = null;
    }
    this.emit();
  }

  // ── Palavra-passe ─────────────────────────────────────────────────────

  /** Guarda o hash da palavra-passe. Só em memória. */
  async setPassword(phrase: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(phrase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    this.passwordHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    this.emit();
  }

  /**
   * Compara uma frase contra o hash guardado. Usado quando a voz reconhece
   * a palavra-passe — a frase transcrita é passada aqui.
   */
  async verify(phrase: string): Promise<boolean> {
    if (!this.passwordHash) return false;
    const encoder = new TextEncoder();
    const data = encoder.encode(phrase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hash === this.passwordHash;
  }

  get hasPassword(): boolean {
    return this.passwordHash !== null;
  }

  // ── Sessão ────────────────────────────────────────────────────────────

  get sessionActive(): boolean {
    if (!this.sessionExpiresAt) return false;
    return Date.now() < this.sessionExpiresAt;
  }

  /** Duração da sessão em minutos. */
  sessionDurationMinutes = 30;

  /** Abre uma sessão de controlo direto por N minutos. */
  startSession(): void {
    this.sessionExpiresAt = Date.now() + this.sessionDurationMinutes * 60_000;
    logService.log('info', 'auditoria', 'Sessão de controlo direto iniciada');
    this.emit();
  }

  endSession(): void {
    this.sessionExpiresAt = null;
    logService.log('info', 'auditoria', 'Sessão de controlo direto terminada');
    this.emit();
  }

  // ── Modo simulado ─────────────────────────────────────────────────────

  get isSimulated(): boolean {
    return this.simulatedMode;
  }

  setSimulated(value: boolean): void {
    this.simulatedMode = value;
    this.emit();
  }

  // ── Passos e auditoria ────────────────────────────────────────────────

  get history(): readonly StepRecord[] {
    return this.steps;
  }

  // ── Passo pendente (overlay de confirmação) ──────────────────────────

  private pendingStep: ControlStep | null = null;

  /** O passo à espera de confirmação no overlay — `null` quando não há nenhum. */
  get pending(): ControlStep | null {
    return this.pendingStep;
  }

  /**
   * Põe um passo à espera de confirmação e devolve o que dizer a quem pediu
   * (o modelo, a voz) — uma recusa se o controlo direto estiver desligado ou
   * sem sessão ativa, ou o aviso de que ficou a aguardar confirmação.
   *
   * **A porta de presença é verificada aqui, no pedido** — antes de o passo
   * sequer chegar ao overlay. Um passo recusado nunca aparece no ecrã, porque
   * não havia presença para o autorizar.
   */
  requestStep(step: ControlStep): string {
    if (!this.enabled) {
      return 'O controlo direto está desligado — liga-o em Privacidade antes de eu poder mexer no computador.';
    }
    if (!this.sessionActive) {
      return 'Não há uma sessão de controlo direto ativa — abre uma em Privacidade ou diz a palavra-passe.';
    }

    this.pendingStep = step;
    this.emit();
    return `Pedido de controlo direto: ${step.description}. A aguardar confirmação no ecrã.`;
  }

  /** Confirma o passo pendente — regista-o e executa (ou simula) via `executeStep`. */
  confirm(): void {
    const step = this.pendingStep;
    this.pendingStep = null;
    if (step) this.executeStep(step, true);
  }

  /** Recusa o passo pendente — fica registado como recusado, nada executa. */
  cancel(): void {
    const step = this.pendingStep;
    this.pendingStep = null;
    if (step) this.executeStep(step, false);
  }

  /**
   * Travão de mão (Fase 3.4) — acionado por `Esc Esc`.
   *
   * Pára tudo de imediato: cancela o passo pendente e termina a sessão, sem
   * passar pelo registo por passo (o passo cancelado aqui nunca chegou a
   * executar, por isso não há nada a "recusar" — simplesmente deixa de existir).
   * É a diferença entre "não faças isto" (o botão Recusar) e "pára já, tudo"
   * (o travão): este último também mata a sessão, para um segundo passo não
   * vir logo a seguir a pedir confirmação outra vez.
   */
  emergencyStop(): void {
    const hadPending = this.pendingStep !== null;
    const hadSession = this.sessionActive;

    this.pendingStep = null;
    this.sessionExpiresAt = null;

    if (hadPending || hadSession) {
      logService.audit('Travão de mão acionado (Esc Esc) — controlo direto parado', 'executado');
      this.emit();
    }
  }

  /**
   * Regista um passo, executa se: confirmado, não simulado, ligado, e com
   * uma sessão de presença ativa.
   *
   * **A porta de presença fica aqui dentro, não em quem chama.** A spec
   * (`docs/spec/fase-3-controlo-direto.md` §1.1) é categórica — "sem isto,
   * nada corre" — mas isso só vale a sério se nenhuma chamada futura puder
   * esquecer de verificar `sessionActive` antes de chamar isto. Uma
   * confirmação no overlay nunca chega a bastar sozinha para uma ação real.
   */
  executeStep(step: ControlStep, confirmed: boolean): void {
    const gateOpen = this.enabled && this.sessionActive;
    const wouldExecute = confirmed && !this.simulatedMode;
    const blockedByGate = wouldExecute && !gateOpen;

    const record: StepRecord = {
      id: step.id,
      description: step.description,
      risk: step.risk,
      at: Date.now(),
      wasSimulated: this.simulatedMode,
      wasConfirmed: confirmed,
    };

    this.steps = [...this.steps, record];
    logService.log(
      'info',
      'auditoria',
      `Controlo direto: ${this.simulatedMode ? '[SIMULADO] ' : ''}${blockedByGate ? '[SEM SESSÃO ATIVA — RECUSADO] ' : ''}${step.description} (${RISK_LABELS[step.risk]}) — ${confirmed ? 'confirmado' : 'recusado'}`,
    );

    if (wouldExecute && gateOpen) {
      try {
        step.execute();
      } catch (err) {
        logService.log('erro', 'auditoria', `Controlo direto falhou: ${step.description}`, (err as Error).message);
      }
    }

    this.emit();
  }

  clearHistory(): void {
    this.steps = [];
    this.emit();
  }

  // ── Observadores ──────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const directControlService = new DirectControlService();
