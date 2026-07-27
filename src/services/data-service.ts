/**
 * Base dos serviços de dados com sondagem.
 *
 * O `SystemService` já fazia isto: uma só sondagem partilhada por todos os
 * subscritores, que pára quando ninguém ouve e suspende quando a janela vai
 * para segundo plano. Repetir esse ciclo em quatro serviços novos seria
 * quatro sítios para o mesmo bug.
 *
 * Uma subclasse só implementa `fetch`. Tudo o resto vem daqui.
 */

export type DataListener<T> = (value: T) => void;

export interface DataServiceOptions {
  /** Intervalo entre leituras. */
  readonly intervalMs: number;
  /**
   * `false` para serviços que não se atualizam sozinhos — o estado da música,
   * por exemplo, só muda quando o utilizador carrega num botão.
   */
  readonly autoPoll?: boolean;
}

export abstract class PollingDataService<T> {
  private readonly listeners = new Set<DataListener<T>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private inFlight: Promise<T | null> | null = null;

  protected latest: T | null = null;

  constructor(private readonly options: DataServiceOptions) {}

  /** Última leitura conhecida, sem esperar pela próxima sondagem. */
  get current(): T | null {
    return this.latest;
  }

  /**
   * Subscreve as leituras. Devolve a função que cancela a subscrição — quando
   * o último subscritor sai, a sondagem pára.
   */
  subscribe(listener: DataListener<T>): () => void {
    this.listeners.add(listener);
    if (this.latest !== null) listener(this.latest);
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

  /**
   * Uma leitura avulsa, fora do ciclo.
   *
   * Se já houver uma em curso, devolve essa em vez de disparar outra — sem
   * isto, três widgets a montar ao mesmo tempo fariam três pedidos iguais.
   */
  async refresh(): Promise<T | null> {
    this.inFlight ??= this.runFetch();
    return this.inFlight;
  }

  private async runFetch(): Promise<T | null> {
    try {
      const value = await this.fetch();
      if (value !== null) {
        this.latest = value;
        this.emit(value);
      }
      return value;
    } catch (error) {
      console.warn(`[${this.constructor.name}] a leitura falhou:`, error);
      return null;
    } finally {
      this.inFlight = null;
    }
  }

  /** Atualiza o valor sem passar pelo `fetch` — para mutações locais. */
  protected publish(value: T): void {
    this.latest = value;
    this.emit(value);
  }

  private start(): void {
    if (this.timer !== null || this.paused) return;

    void this.refresh();
    if (this.options.autoPoll === false) return;

    this.timer = setInterval(() => void this.refresh(), this.options.intervalMs);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private emit(value: T): void {
    for (const listener of this.listeners) listener(value);
  }

  /** Vai buscar os dados. `null` significa "sem dados", não erro. */
  protected abstract fetch(): Promise<T | null>;
}
