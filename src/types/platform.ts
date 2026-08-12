/** Plataformas que o adapter sabe distinguir. */
export type PlatformKind = 'desktop' | 'android' | 'web';

/**
 * Capacidades que variam por plataforma.
 *
 * A interface pergunta `capabilities.systemTray` — nunca `platform === 'android'`.
 * Se um componente precisar de saber a plataforma, falta aqui uma capacidade.
 */
export interface PlatformCapabilities {
  /** Métricas reais do sistema (CPU, RAM, disco, rede). */
  readonly systemMetrics: boolean;
  /** Lista de processos. O Android isola as aplicações e não permite. */
  readonly processList: boolean;
  /** Ícone na bandeja do sistema. */
  readonly systemTray: boolean;
  /** Atalho de teclado global, fora da janela da aplicação. */
  readonly globalShortcut: boolean;
  /** Janelas arrastáveis e redimensionáveis. */
  readonly windowManagement: boolean;
  /** Notificações nativas do sistema operativo. */
  readonly nativeNotifications: boolean;
  /** Abrir ficheiros e URLs na aplicação predefinida do sistema. */
  readonly shellOpen: boolean;
  /** Diálogos nativos de ficheiro. */
  readonly fileDialogs: boolean;
  /** Persistência através do plugin `store` do Tauri, em vez do localStorage. */
  readonly nativeStorage: boolean;
  /** Reconhecimento e síntese de voz (Web Speech API). */
  readonly voice: boolean;
  /** Autenticação biométrica. */
  readonly biometrics: boolean;
  /** Janela de Terminal com um shell a sério (PTY), não simulado. */
  readonly terminal: boolean;
  /** Cofre de segredos (Credential Manager no Windows, Keychain no macOS). */
  readonly secretVault: boolean;
  /** Observador de pastas para gatilhos de automação. */
  readonly fileWatcher: boolean;
  /** Monitor de dispositivos USB para gatilhos de automação. */
  readonly usbMonitor: boolean;
  /** Monitor de bateria para gatilhos de automação. */
  readonly batteryMonitor: boolean;
  /** Leitura real do disco (Explorador), com pasta-raiz escolhida pela pessoa. */
  readonly realFilesystem: boolean;
}

/** Informação da plataforma, resolvida uma vez no arranque. */
export interface PlatformInfo {
  readonly kind: PlatformKind;
  /** `true` quando corre dentro do Tauri (desktop ou Android). */
  readonly isTauri: boolean;
  /** `true` em ecrãs de toque — desativa cursor personalizado e tooltips. */
  readonly isTouch: boolean;
  readonly osName: string | null;
  readonly osVersion: string | null;
  readonly arch: string | null;
}
