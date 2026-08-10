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

  /** Regista um passo, executa se não for simulado e tiver sido confirmado. */
  executeStep(step: ControlStep, confirmed: boolean): void {
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
      `Controlo direto: ${this.simulatedMode ? '[SIMULADO] ' : ''}${step.description} (${RISK_LABELS[step.risk]}) — ${confirmed ? 'confirmado' : 'recusado'}`,
    );

    if (confirmed && !this.simulatedMode) {
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
