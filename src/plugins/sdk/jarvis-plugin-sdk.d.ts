/**
 * Tipos do JARVIS Plugin SDK — para autores de plugins.
 *
 * Estes tipos descrevem o objeto `window.core` que a SDK expõe dentro do
 * iframe sandboxed. Não são importáveis pelo plugin (o iframe não tem
 * `allow-same-origin` nem bundler), mas servem de referência e para
 * validação de tipo ao escrever.
 */

export interface JarvisPluginSDK {
  /** Envia uma notificação para o sistema. `plugins.notifications`. */
  notify(titulo: string, corpo: string): Promise<boolean>;

  fs: {
    /** Lê um ficheiro dentro da pasta declarada no manifesto. */
    read(caminho: string): Promise<string>;

    /** Escreve um ficheiro dentro da pasta declarada. */
    write(caminho: string, conteudo: string): Promise<boolean>;

    /** Lista ficheiros e pastas no caminho dado. */
    list(caminho?: string): Promise<readonly { nome: string; isDir: boolean }[]>;
  };

  /**
   * Pedido de rede limitado aos domínios autorizados no manifesto.
   * `plugins.network`.
   */
  fetch(
    url: string,
    opcoes?: {
      readonly method?: string;
      readonly headers?: Record<string, string>;
      readonly body?: string;
    },
  ): Promise<{ readonly status: number; readonly body: string }>;

  automation: {
    /** Dispara uma automação já existente — nunca cria. `plugins.notifications`. */
    run(nome: string): Promise<boolean>;
  };

  window: {
    /**
     * Abre uma janela do sistema. `plugins.windows`.
     *
     * `app` tem de ser um identificador de aplicação que exista
     * (ex.: 'emails', 'tarefas', 'projects').
     */
    open(app: string, titulo?: string): Promise<string>;
  };

  command: {
    /**
     * Regista um comando na paleta. `plugins.commands`.
     *
     * O comando aparece na Command Palette (Ctrl+K) com o nome e a
     * descrição dados. O `id` é usado para evitar duplicados.
     */
    register(id: string, nome: string, descricao: string): Promise<boolean>;
  };

  event: {
    /**
     * Subscreve um evento do sistema. `plugins.events`.
     *
     * `evento` é o nome do evento (ex.: 'tarefa:concluida', 'email:novo').
     * Devolve uma função para cancelar a subscrição.
     */
    on(evento: string, callback: (payload: unknown) => void): Promise<() => void>;
  };
}

declare global {
  interface Window {
    readonly core: JarvisPluginSDK;
  }
}
