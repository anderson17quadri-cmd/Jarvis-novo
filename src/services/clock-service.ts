/**
 * Relógio partilhado — um só temporizador para todos os componentes.
 *
 * O hook `useClock` existente criava um `setInterval` por componente. Este
 * serviço concentra o temporizador num sítio só: o primeiro subscritor
 * liga-o, o último desliga-o, e o estado da janela suspende-o sem perder
 * os subscritores.
 *
 * React não entra aqui — é um serviço puro, como o `ThemeService`.
 */

export type ClockListener = (now: Date) => void;

/** Atualização a cada 15 segundos — chega para um relógio de horas e minutos. */
const TICK_MS = 15_000;

export class ClockService {
  private readonly listeners = new Set<ClockListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  get now(): Date {
    return new Date();
  }

  /**
   * Subscreve atualizações do relógio. Devolve a função que cancela a
   * subscrição — quando o último subscritor sai, o temporizador pára.
   */
  subscribe(listener: ClockListener): () => void {
    this.listeners.add(listener);
    // Primeira atualização imediata — o componente não espera 15s pelo
    // primeiro tick.
    listener(this.now);
    this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  /** Suspende sem perder os subscritores (janela em segundo plano). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;

    if (paused) this.stop();
    else if (this.listeners.size > 0) this.start();
  }

  private start(): void {
    if (this.timer !== null || this.paused) return;

    this.timer = setInterval(() => {
      const date = this.now;
      for (const listener of this.listeners) listener(date);
    }, TICK_MS);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

export const clockService = new ClockService();
