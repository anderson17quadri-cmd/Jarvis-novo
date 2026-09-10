import type { PlatformCapabilities, PlatformInfo } from '@/types/platform';
import type { ScreenRect } from '@/types/screen-zone';
import type { RealFileEntry, RealFilesRoot } from '@/types/real-file-entry';
import type { ProcessInfo, StaticSystemInfo, SystemSnapshot } from '@/types/system';
import type { TerminalExitEvent, TerminalOutputEvent } from '@/types/terminal';
import type { MusicFileEntry } from '@/types/music';
import type { ObsidianNote, RealObsidianRoot } from '@/types/obsidian';
import type { WebPageContent } from '@/types/web-page';
import type { OllamaPullEvent } from '@/types/ollama-pull';
import type {
  ImapMessageDto,
  MailFetchParams,
  MailSendParams,
  MailSetFlagParams,
} from '@/types/mail';

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

  // ── Controlo direto (Fase 3.2) ──────────────────────────────────────────
  /**
   * Abre um ficheiro ou aplicação pelo caminho, no abridor predefinido do
   * sistema — o equivalente a um duplo-clique, não a execução arbitrária.
   * `false` se a plataforma não suportar ou o caminho não existir.
   */
  openPath(path: string): Promise<boolean>;

  // ── Controlo direto (Fases 3.3–3.4) ──────────────────────────────────────
  /**
   * Tira um print do monitor principal, tapa as zonas sensíveis e devolve-o em
   * base64 PNG. `null` se a plataforma não suportar ou a captura falhar — nunca
   * lança. O print nunca é escrito em disco: vive só em memória o tempo da
   * decisão.
   */
  captureScreen(zones: readonly ScreenRect[]): Promise<string | null>;
  /** Move o cursor para coordenadas absolutas. `false` se recusado (fora do ecrã ou sem suporte). */
  moveMouseTo(x: number, y: number): Promise<boolean>;
  /** Clica com o botão esquerdo nas coordenadas dadas. `false` se recusado. */
  clickAt(x: number, y: number): Promise<boolean>;
  /** Escreve texto, tecla a tecla — nunca interpretado como comando. `false` se recusado. */
  typeText(text: string): Promise<boolean>;

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

  // ── Biometria ────────────────────────────────────────────────────────────
  /**
   * `true` se este dispositivo tem o Windows Hello (ou equivalente)
   * configurado — verificação em runtime, não só se a plataforma o suporta
   * em teoria. `capabilities.biometrics` diz se vale a pena perguntar;
   * isto diz se a máquina concreta tem sensor/PIN prontos.
   */
  checkBiometricAvailability(): Promise<boolean>;
  /**
   * Pede a verificação a sério — dispara o ecrã nativo. `message` explica à
   * pessoa porque está a ser pedida.
   *
   * `'unavailable'` cobre tanto "esta plataforma não tem" como "este
   * dispositivo não tem sensor configurado" — quem chama trata os dois da
   * mesma forma (cai para a palavra-passe).
   */
  requestBiometricVerification(message: string): Promise<'verified' | 'denied' | 'unavailable'>;

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

  // ── Sistema de ficheiros real ────────────────────────────────────────────
  /**
   * Abre o diálogo nativo para escolher uma pasta. `null` se a pessoa
   * cancelar ou a plataforma não suportar — não distingue os dois casos, a
   * interface reage da mesma forma a ambos.
   */
  pickFilesRoot(): Promise<string | null>;
  /**
   * Declara a pasta-raiz do Explorador real — nada fora dela fica acessível
   * a partir daqui. `null` se o caminho não for uma pasta legível ou a
   * plataforma não suportar.
   */
  filesSetRoot(path: string): Promise<RealFilesRoot | null>;
  /**
   * Lê um nível de uma pasta real — a raiz declarada, se `path` for `null`.
   * `null` se ainda não houver raiz, o caminho estiver fora dela, ou a
   * leitura falhar.
   */
  filesReadDir(path: string | null): Promise<readonly RealFileEntry[] | null>;

  // ── Correio real ─────────────────────────────────────────────────────────
  /**
   * Lê as mensagens mais recentes da INBOX por IMAP. Lista vazia onde não há
   * correio real (`capabilities.mail` é `false`) — mas **lança** quando o
   * desktop tem correio e a ligação falha, para a interface distinguir
   * "sem mensagens" de "não conseguiu ligar".
   */
  mailFetch(params: MailFetchParams): Promise<readonly ImapMessageDto[]>;
  /** Muda uma bandeira IMAP — `seen` (lida) ou `flagged` (favorita). */
  mailSetFlag(params: MailSetFlagParams): Promise<void>;
  /** Envia uma mensagem por SMTP. Lança se o envio falhar. */
  mailSend(params: MailSendParams): Promise<void>;

  // ── Música local ─────────────────────────────────────────────────────────
  /**
   * Declara a pasta de música local — nada fora dela fica acessível, e o
   * protocolo `asset` do Tauri passa a servir os ficheiros de lá. `null` se o
   * caminho não for uma pasta legível ou a plataforma não suportar.
   */
  musicSetRoot(path: string): Promise<RealFilesRoot | null>;
  /**
   * Lê os ficheiros de áudio na pasta declarada. Lista vazia se ainda não
   * houver pasta, a leitura falhar, ou a plataforma não suportar.
   */
  musicReadDir(): Promise<readonly MusicFileEntry[]>;
  /**
   * Converte um caminho de ficheiro num URL que o `<audio>` consegue carregar
   * (`asset://localhost/…`). Vazio onde a plataforma não suporta.
   */
  toLocalMediaUrl(path: string): string;

  // ── Vault Obsidian (Peça 17) ─────────────────────────────────────────────
  /**
   * Declara a pasta do vault. `null` se o caminho não for uma pasta legível
   * ou a plataforma não suportar.
   */
  obsidianSetRoot(path: string): Promise<RealObsidianRoot | null>;
  /**
   * Lista todas as notas `.md` do vault, recursivamente. Lista vazia se
   * ainda não houver vault, a leitura falhar, ou a plataforma não suportar.
   */
  obsidianListNotes(): Promise<readonly ObsidianNote[]>;
  /**
   * Lê o conteúdo de uma nota — `path` é o caminho relativo devolvido por
   * `obsidianListNotes`. `null` se a nota não existir, estiver fora do
   * vault, ou a plataforma não suportar.
   */
  obsidianReadNote(path: string): Promise<string | null>;
  /**
   * Cria ou substitui uma nota. `path` é relativo à raiz do vault; pastas
   * intermédias são criadas se preciso. `false` se a escrita falhar ou a
   * plataforma não suportar.
   */
  obsidianWriteNote(path: string, content: string): Promise<boolean>;

  // ── Navegador controlado pelo assistente (Peça 19) ───────────────────────
  /**
   * Busca uma página `https` e devolve o título e o texto visível, já sem
   * script/style/noscript. `null` se o pedido falhar (rede, timeout, URL não
   * permitido, tipo de conteúdo não é HTML) ou a plataforma não suportar —
   * nunca lança, para o chamador tratar como "não consegui" sem exceção.
   */
  fetchPageText(url: string): Promise<WebPageContent | null>;

  // ── Voz clonada local ─────────────────────────────────────────────────────
  /**
   * Reinicia o serviço local de voz (`voice-clone-service/`) — mata o que
   * estiver na porta 8090 e arranca outro, com um contexto CUDA fresco.
   * `false` onde a plataforma não tem serviço de voz local (web/Android) ou
   * quando o reinício falha. Nunca lança.
   */
  restartVoiceService(): Promise<boolean>;

  startWakeWord(word: string): Promise<boolean>;
  stopWakeWord(): Promise<void>;

  // ── Ollama ──────────────────────────────────────────────────────────────
  /**
   * Progresso do descarregamento automático do modelo por omissão, quando o
   * Ollama arranca sem nenhum modelo instalado (o JARVIS puxa-o sozinho —
   * "sem precisar de adicionar mais nada"). Devolve a função de cancelamento.
   * Nunca dispara nada nas plataformas sem Ollama nativo (web/Android) — o
   * `unlisten` devolvido aí é só um no-op.
   */
  onOllamaPull(handler: (event: OllamaPullEvent) => void): Promise<() => void>;
}
