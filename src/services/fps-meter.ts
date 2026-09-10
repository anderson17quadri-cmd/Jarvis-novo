/**
 * Fotogramas por segundo (Parte 16 §Desempenho).
 *
 * "FPS fica para depois" — a nota dizia isso desde o Bloco H. Aqui está: uma
 * amostra a sério, por `requestAnimationFrame`, e não um número simulado.
 *
 * Só conta enquanto alguém estiver a olhar. `start()` devolve a função que
 * larga a contagem, e o relógio só corre com pelo menos um interessado — a
 * mesma regra do `soundService`, que só cria o `AudioContext` ao primeiro som:
 * um contador a correr sem ninguém a ler é ciclos gastos à toa.
 */

const SAMPLE_MS = 1_000;

class FpsMeter {
  private frames = 0;
  private sampleStartedAt = 0;
  private frameHandle: number | null = null;
  private listeners = 0;
  /**
   * `null` enquanto não há amostra completa. Um valor antigo mostrado como se
   * fosse atual é pior do que dizer "a medir" — é a mesma regra da memória do
   * heap, que fica ausente em vez de zero.
   */
  private value: number | null = null;

  get current(): number | null {
    return this.value;
  }

  /** Começa a contar, se ainda ninguém estava a olhar. Devolve como parar. */
  start(): () => void {
    this.listeners += 1;
    if (this.listeners === 1) this.begin();

    let stopped = false;
    return () => {
      if (stopped) return; // idempotente — chamar duas vezes não larga a mais
      stopped = true;
      this.stop();
    };
  }

  private begin(): void {
    if (typeof requestAnimationFrame !== 'function') return;

    this.frames = 0;
    this.sampleStartedAt = now();

    const tick = (): void => {
      if (this.listeners <= 0) return; // o último interessado já saiu

      this.frames += 1;
      const elapsed = now() - this.sampleStartedAt;

      if (elapsed >= SAMPLE_MS) {
        this.value = Math.round((this.frames * 1_000) / elapsed);
        this.frames = 0;
        this.sampleStartedAt = now();
      }

      this.frameHandle = requestAnimationFrame(tick);
    };

    this.frameHandle = requestAnimationFrame(tick);
  }

  private stop(): void {
    this.listeners = Math.max(0, this.listeners - 1);
    if (this.listeners > 0) return;

    if (this.frameHandle !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameHandle);
    }
    this.frameHandle = null;
    this.value = null;
  }
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export const fpsMeter = new FpsMeter();
