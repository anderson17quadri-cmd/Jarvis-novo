import type { PlatformCapabilities, PlatformInfo } from '@/types/platform';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';
import type { TerminalExitEvent, TerminalOutputEvent } from '@/types/terminal';

/**
 * O contrato que separa a interface do sistema operativo.
 *
 * Fluxo obrigatório do projeto:
 *   Componente → Hook → Service → PlatformAdapter → invoke() → Rust
 *
 * Nenhum ficheiro fora de `src/platform/` pode chamar `invoke`. Se algo
 * precisar de falar com o Rust, acrescenta-se um método aqui e implementa-se
 * nos três adapters.
 *
 * Regra da degradação: um método que a plataforma não suporta devolve `null`,
 * lista vazia ou um valor simulado — nunca lança. Quem chama olha para
 * `capabilities` antes de mostrar o elemento na interface.
 */
export interface PlatformAdapter {
  readonly info: PlatformInfo;
  readonly capabilities: PlatformCapabilities;

  /** Chamado uma vez no arranque. Resolve `info` e regista listeners nativos. */
  initialize(): Promise<void>;

  // ── Sistema ──────────────────────────────────────────────────────────────
  /** Fotografia das métricas. `null` se a plataforma não as souber ler. */
  getSystemSnapshot(): Promise<SystemSnapshot | null>;
  /** Informação estática. `null` se indisponível. */
  getStaticSystemInfo(): Promise<StaticSystemInfo | null>;
  /** Processos mais pesados. Lista vazia onde não há acesso. */
  getTopProcesses(limit?: number): Promise<readonly ProcessInfo[]>;

  // ── Persistência ─────────────────────────────────────────────────────────
  storageGet<T>(key: string, fallback: T): Promise<T>;
  storageSet<T>(key: string, value: T): Promise<void>;
  storageRemove(key: string): Promise<void>;

  // ── Notificações nativas ─────────────────────────────────────────────────
  /** `false` se não foi possível notificar — quem chama cai no toast interno. */
  sendNativeNotification(title: string, body: string): Promise<boolean>;

  // ── Shell ────────────────────────────────────────────────────────────────
  /**
   * Abre um URL na aplicação predefinida.
   *
   * Aceita apenas `https:` e `mailto:` — a capability do Tauri impõe o mesmo do
   * lado Rust. A interface nunca consegue mandar executar um comando arbitrário.
   */
  openExternal(url: string): Promise<boolean>;

  // ── Cofre de segredos ────────────────────────────────────────────────────
  /** Guarda um segredo no chaveiro do sistema. `false` se não disponível. */
  secretSet(key: string, value: string): Promise<boolean>;
  /** Lê um segredo. `null` se não existir ou não disponível. */
  secretGet(key: string): Promise<string | null>;
  /** Apaga um segredo. `false` se não disponível. */
  secretDelete(key: string): Promise<boolean>;

  // ── Gatilhos nativos de automação ──────────────────────────────────────────
  /**
   * Começa a observar uma pasta. Devolve o `watchId` (caminho canonicalizado)
   * ou `null` se a plataforma não suportar.
   */
  watchFolder(path: string): Promise<string | null>;
  /** Pára de observar uma pasta. */
  unwatchFolder(watchId: string): Promise<void>;
  /**
   * Lê o estado atual da bateria. `null` se não houver bateria (desktop fixo
   * sem UPS) ou se a plataforma não suportar a leitura.
   */
  getBatteryStatus(): Promise<{ percent: number; isCharging: boolean; isPlugged: boolean } | null>;
  /** Ouve eventos de alteração numa pasta. Devolve função para cancelar. */
  onFileChanged(handler: (event: { path: string; watchId: string; changeKind: string }) => void): Promise<() => void>;
  /** Ouve eventos de ligação/desligação USB. Devolve função para cancelar. */
  onUsbChanged(handler: (event: { action: string; deviceName: string | null }) => void): Promise<() => void>;
  /** Ouve eventos de mudança de bateria. Devolve função para cancelar. */
  onBatteryChanged(handler: (event: { percent: number; isCharging: boolean; isPlugged: boolean }) => void): Promise<() => void>;

  // ── Janela nativa ────────────────────────────────────────────────────────
  /** Sem efeito onde não há gestão de janelas. */
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  hideWindow(): Promise<void>;

  // ── Atalho global ────────────────────────────────────────────────────────
  /**
   * Regista o callback do atalho global de invocação.
   * Devolve a função que cancela a subscrição — sempre válida, mesmo quando a
   * plataforma não suporta atalhos (aí é uma função vazia).
   */
  onGlobalInvoke(handler: () => void): Promise<() => void>;

  // ── Terminal ─────────────────────────────────────────────────────────────
  /**
   * Abre uma sessão de terminal nova (um PTY a sério, do lado Rust) e devolve
   * o seu id. `null` onde `capabilities.terminal` é `false`.
   */
  terminalSpawn(cols: number, rows: number): Promise<string | null>;
  /** Escreve texto no stdin da sessão — um comando, ou uma tecla. */
  terminalWrite(sessionId: string, data: string): Promise<void>;
  /** A janela mudou de tamanho — o shell precisa de saber. */
  terminalResize(sessionId: string, cols: number, rows: number): Promise<void>;
  /** Termina o processo e liberta a sessão. */
  terminalKill(sessionId: string): Promise<void>;
  /** Ouve a saída de todas as sessões — quem chama filtra pelo `sessionId`. */
  onTerminalOutput(handler: (event: TerminalOutputEvent) => void): Promise<() => void>;
  /** Ouve o fim de qualquer sessão. */
  onTerminalExit(handler: (event: TerminalExitEvent) => void): Promise<() => void>;
}
