/**
 * Event Bus do sistema (Parte 11 §Event Bus global).
 *
 * Um sítio por onde passam os factos do sistema: arrancou, o tema mudou,
 * chegou email, instalou-se um plugin. Quem produz não sabe quem escuta, e
 * quem escuta não conhece quem produz — é isso que permite ao motor de
 * automações reagir a coisas sem que o resto do sistema saiba que ele existe.
 *
 * Os nomes são fechados de propósito: um bus com eventos em texto livre acaba
 * com dois módulos a escrever `email:novo` e `email:recebido` e a nunca se
 * encontrarem.
 */

export interface SystemEvents {
  /** O ambiente de trabalho terminou de montar. */
  'desktop:carregado': Record<string, never>;
  'tema:alterado': { readonly theme: string };
  'estado:alterado': { readonly state: string };
  'notificacao:nova': { readonly title: string; readonly kind: string; readonly category: string };
  'email:novo': { readonly from: string; readonly subject: string };
  'plugin:instalado': { readonly pluginId: string };
  'plugin:removido': { readonly pluginId: string };
  'janela:aberta': { readonly appId: string };
  'tarefa:concluida': { readonly title: string };
}

export type SystemEventName = keyof SystemEvents;

/** Nomes legíveis, para a interface das automações. */
export const EVENT_LABELS: Record<SystemEventName, string> = {
  'desktop:carregado': 'O ambiente de trabalho carregar',
  'tema:alterado': 'Mudar de tema',
  'estado:alterado': 'Mudar o estado do sistema',
  'notificacao:nova': 'Chegar uma notificação',
  'email:novo': 'Chegar um email',
  'plugin:instalado': 'Instalar um plugin',
  'plugin:removido': 'Remover um plugin',
  'janela:aberta': 'Abrir uma janela',
  'tarefa:concluida': 'Concluir uma tarefa',
};

export const ALL_EVENTS = Object.keys(EVENT_LABELS) as readonly SystemEventName[];

type Listener<K extends SystemEventName> = (payload: SystemEvents[K]) => void;

/**
 * Ouvinte sem o tipo do payload.
 *
 * O mapa guarda ouvintes de eventos diferentes, com payloads diferentes — não
 * há um tipo comum que os cubra. `never` no parâmetro é o que aceita todos:
 * qualquer função que receba um payload concreto serve. A API pública
 * continua tipada evento a evento.
 */
type AnyListener = (payload: never) => void;

export class EventBus {
  private readonly listeners = new Map<SystemEventName, Set<AnyListener>>();

  /** Subscreve um evento. Devolve a função que cancela. */
  on<K extends SystemEventName>(event: K, listener: Listener<K>): () => void {
    const set = this.listeners.get(event) ?? new Set<AnyListener>();
    set.add(listener);
    this.listeners.set(event, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  /**
   * Anuncia um evento.
   *
   * Um ouvinte que rebente não pode calar os outros nem parar quem emitiu —
   * daí o `try`. Emitir um evento é uma informação, não um pedido.
   */
  emit<K extends SystemEventName>(event: K, payload: SystemEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const listener of [...set]) {
      try {
        (listener as Listener<K>)(payload);
      } catch {
        // Um ouvinte com defeito não estraga o evento para os outros.
      }
    }
  }

  /** Quantos ouvintes tem um evento. Para testes e para o painel de diagnóstico. */
  countListeners(event: SystemEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
