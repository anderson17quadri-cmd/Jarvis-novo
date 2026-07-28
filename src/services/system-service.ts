import { getPlatformAdapter } from '@/platform';
import type { PlatformAdapter } from '@/platform';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';

/** Intervalo predefinido entre leituras, em milissegundos. */
export const DEFAULT_POLL_INTERVAL_MS = 2_000;
/** Quantas leituras o histórico guarda — o suficiente para os gráficos. */
export const HISTORY_LENGTH = 60;

export type SnapshotListener = (snapshot: SystemSnapshot) => void;

/**
 * Métricas do sistema.
 *
 * Uma única sondagem alimenta todos os subscritores: abrir três janelas com
 * gráficos não triplica as chamadas ao Rust. A sondagem pára sozinha quando não
 * há ninguém a ouvir e quando a janela vai para segundo plano.
 */
export class SystemService {
  private readonly listeners = new Set<SnapshotListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private staticInfo: StaticSystemInfo | null = null;
  private latest: SystemSnapshot | null = null;
  private paused = false;

  constructor(
    private readonly adapter: PlatformAdapter = getPlatformAdapter(),
    private intervalMs: number = DEFAULT_POLL_INTERVAL_MS,
  ) {}

  get isSupported(): boolean {
    return this.adapter.capabilities.systemMetrics;
  }

  get hasProcessList(): boolean {
    return this.adapter.capabilities.processList;
  }

  /** Última leitura conhecida, sem esperar pela próxima sondagem. */
  get lastSnapshot(): SystemSnapshot | null {
    return this.latest;
  }

  /**
   * Subscreve as leituras. Devolve a função que cancela a subscrição — quando
   * o último subscritor sai, a sondagem pára.
   */
  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    if (this.latest) listener(this.latest);
    this.start();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  /** Suspende a sondagem sem perder os subscritores (janela em segundo plano). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stop();
    } else if (this.listeners.size > 0) {
      this.start();
    }
  }

  /**
   * Muda o ritmo da sondagem (estados do sistema, Parte 9).
   *
   * Reinicia o temporizador se já estiver a correr — sem isto, o novo intervalo
   * só valeria na próxima vez que alguém subscrevesse.
   */
  setInterval(intervalMs: number): void {
    if (this.intervalMs === intervalMs) return;
    this.intervalMs = intervalMs;

    if (this.timer !== null) {
      this.stop();
      this.start();
    }
  }

  /** O ritmo em vigor, em milissegundos. */
  get pollIntervalMs(): number {
    return this.intervalMs;
  }

  async getStaticInfo(): Promise<StaticSystemInfo | null> {
    this.staticInfo ??= await this.adapter.getStaticSystemInfo();
    return this.staticInfo;
  }

  async getTopProcesses(limit = 8): Promise<readonly ProcessInfo[]> {
    return this.adapter.getTopProcesses(limit);
  }

  /** Uma leitura avulsa, fora do ciclo de sondagem. */
  async readOnce(): Promise<SystemSnapshot | null> {
    const snapshot = await this.adapter.getSystemSnapshot();
    if (snapshot) {
      this.latest = snapshot;
      this.emit(snapshot);
    }
    return snapshot;
  }

  private start(): void {
    if (this.timer !== null || this.paused || !this.isSupported) return;
    void this.readOnce();
    this.timer = setInterval(() => void this.readOnce(), this.intervalMs);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private emit(snapshot: SystemSnapshot): void {
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

/** Instância partilhada por toda a aplicação. */
export const systemService = new SystemService();
