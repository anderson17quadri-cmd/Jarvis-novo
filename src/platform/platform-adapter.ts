import type { PlatformCapabilities, PlatformInfo } from '@/types/platform';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';

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
}
