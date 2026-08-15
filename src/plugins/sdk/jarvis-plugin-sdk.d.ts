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
     * descrição dados. `callback` é chamado quando a pessoa executa o
     * comando na paleta. Devolve uma função para cancelar o registo.
     */
    register(id: string, nome: string, descricao: string, callback: () => void): Promise<() => void>;
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

  storage: {
    /**
     * Guarda um valor no armazenamento do plugin. `plugins.storage`.
     *
     * As chaves recebem automaticamente o prefixo `plugins:<pluginId>:`
     * — um plugin nunca lê as preferências de outro.
     */
    set(chave: string, valor: unknown): Promise<boolean>;

    /**
     * Lê um valor do armazenamento do plugin. `plugins.storage`.
     *
     * `fallback` é devolvido se a chave não existir (por omissão `null`).
     */
    get<T>(chave: string, fallback?: T): Promise<T>;

    /** Remove uma chave do armazenamento do plugin. `plugins.storage`. */
    remove(chave: string): Promise<boolean>;
  };

  widget: {
    /**
     * Cria (ou atualiza) um widget simples — só título e texto, nunca
     * código nem markup. `plugins.widgets`.
     */
    create(id: string, titulo: string, texto: string): Promise<boolean>;
  };

  menu: {
    /**
     * Adiciona um item ao menu de contexto do ambiente de trabalho.
     * `plugins.menus`.
     *
     * Devolve uma função para deixar de ouvir os cliques.
     */
    add(id: string, rotulo: string, callback: () => void): Promise<() => void>;
  };

  setting: {
    /**
     * Declara uma definição editável — o valor fica no armazenamento do
     * próprio plugin, editável pela interface do Core. `plugins.settings`.
     */
    register(
      chave: string,
      rotulo: string,
      tipo: 'boolean' | 'texto',
      valorOmissao: boolean | string,
    ): Promise<boolean>;
  };

  service: {
    /**
     * Regista um "serviço" — o Core chama `callback` a cada `intervalMs`
     * (com um mínimo de 5000). `plugins.services`.
     *
     * Devolve uma função para parar de ouvir os "ticks" (o serviço em si
     * só para quando o plugin deixa de correr).
     */
    register(id: string, intervalMs: number, callback: () => void): Promise<() => void>;
  };

  panel: {
    /**
     * Adiciona um painel de texto expansível, mostrado ao lado do plugin
     * na Loja. `plugins.panels`.
     */
    add(id: string, titulo: string, texto: string): Promise<boolean>;
  };

  voice: {
    /**
     * Manda o assistente falar um texto em voz alta. `plugins.voice`.
     *
     * Devolve `false` se a voz não estiver disponível neste dispositivo
     * (não há síntese de fala) — a permissão foi concedida, mas não há
     * voz para executar.
     */
    speak(texto: string): Promise<boolean>;
  };

  memory: {
    /**
     * Lê a memória que o assistente guardou sobre a pessoa — preferências
     * ditas em voz alta e últimos pedidos. `plugins.memory`.
     */
    read(): Promise<{
      readonly preferences: Readonly<Record<string, string>>;
      readonly recentPrompts: readonly string[];
    }>;
  };

  shortcut: {
    /**
     * Regista um atalho de teclado. `plugins.shortcuts`.
     *
     * `key` é a tecla (ex.: 'h', 'j'). `modifiers` controla Ctrl/Meta,
     * Shift e Alt. `callback` é chamado quando o atalho é premido.
     * Devolve uma função para cancelar o registo.
     *
     * Atalhos reservados do sistema (Ctrl+K, Ctrl+E, etc.) são recusados.
     */
    register(
      id: string,
      key: string,
      modifiers: { ctrlOrMeta?: boolean; shift?: boolean; alt?: boolean },
      callback: () => void,
    ): Promise<() => void>;
  };
}

declare global {
  interface Window {
    readonly core: JarvisPluginSDK;
  }
}
