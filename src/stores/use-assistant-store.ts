import { create } from 'zustand';

import { createId } from '@/lib/id';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import {
  CONVERSATION_LIMIT,
  MSG_LIMIT,
  SUCCESS_MODE_DURATION_MS,
  TITLE_MAX_LENGTH,
  UNTITLED_CONVERSATION,
} from '@/types/assistant';
import type { AssistantConversation, AssistantMessage, AssistantMode } from '@/types/assistant';

/**
 * Estado do assistente.
 *
 * O histórico são **conversas** (Parte 7.1), não uma lista infinita de
 * mensagens: cada uma tem título, pode ser fixada, exportada e apagada à parte.
 * As mensagens da conversa ativa leem-se pelo seletor `selectMessages`, e não
 * por um campo próprio: um getter no objeto do Zustand perde-se no `set`, que
 * copia o estado com `Object.assign` — e o valor ficava congelado no que era
 * antes da última alteração.
 */

interface AssistantState {
  mode: AssistantMode;
  /** Todas as conversas, fixadas primeiro e depois da mais recente à mais antiga. */
  conversations: readonly AssistantConversation[];
  activeId: string;
  /** Um "ping" que o AI Core observa para desenhar uma onda a partir do centro. */
  pulseCount: number;
  /** O mesmo, para a explosão de partículas do estado de sucesso. */
  burstCount: number;

  setMode: (mode: AssistantMode) => void;
  pulse: () => void;
  /**
   * Celebra uma tarefa concluída: glow verde, pulso e explosão de partículas,
   * com regresso automático a repouso (Parte 8 §Sucesso).
   */
  celebrate: () => void;

  addMessage: (author: AssistantMessage['author'], text: string, isStreaming?: boolean) => string;
  appendToMessage: (id: string, chunk: string) => void;
  finishMessage: (id: string) => void;
  toggleFavourite: (id: string) => void;
  /**
   * Diz que modelo respondeu — "Reasoner · a pergunta pede raciocínio".
   *
   * Não persiste sozinho: quem chama é o `AIService`, mesmo antes de fechar a
   * mensagem, e é o `finishMessage` que grava.
   */
  noteModel: (id: string, model: string) => void;
  /**
   * Tira uma mensagem da conversa.
   *
   * Usada quando o modelo pede ferramentas sem dizer nada: a mensagem fica
   * vazia, e uma linha em branco no histórico é lixo visível.
   */
  removeMessage: (id: string) => void;
  /**
   * Apaga uma resposta e o pedido que a originou, e devolve esse pedido.
   * É o que o `AIService.regenerate` usa. `null` se não houver pedido antes.
   */
  rewindToPrompt: (messageId: string) => string | null;

  startConversation: () => string;
  selectConversation: (id: string) => void;
  togglePinned: (id: string) => void;
  removeConversation: (id: string) => void;
  /** Apaga tudo, incluindo as fixadas. A janela pede confirmação antes. */
  reset: () => void;

  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

function emptyConversation(): AssistantConversation {
  const now = Date.now();
  return {
    id: createId('conv'),
    title: UNTITLED_CONVERSATION,
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    messages: [],
  };
}

/**
 * Título tirado da primeira coisa que se escreveu.
 *
 * Não se inventa um resumo: sem modelo ligado, um título "gerado" seria uma
 * frase à sorte. A primeira mensagem é o que a pessoa escreveu mesmo.
 */
export function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length === 0) return UNTITLED_CONVERSATION;
  if (clean.length <= TITLE_MAX_LENGTH) return clean;

  // Cortar na última palavra inteira, para não ficar "Mostra-me as notific…".
  const cut = clean.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > TITLE_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
}

/**
 * Ordena: fixadas primeiro, depois pela última atividade.
 *
 * Exportada porque o teste do limite precisa da mesma regra, e duplicá-la seria
 * a maneira de as duas divergirem.
 */
export function sortConversations(
  conversations: readonly AssistantConversation[],
): readonly AssistantConversation[] {
  return [...conversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Aplica o limite de histórico.
 *
 * As fixadas nunca caem — é para isso que servem — e a conversa ativa também
 * não, mesmo que esteja vazia e seja a mais antiga de todas.
 */
function withinLimit(
  conversations: readonly AssistantConversation[],
  activeId: string,
): readonly AssistantConversation[] {
  const kept: AssistantConversation[] = [];
  let loose = 0;

  for (const conversation of sortConversations(conversations)) {
    if (conversation.isPinned || conversation.id === activeId) {
      kept.push(conversation);
      continue;
    }

    if (loose < CONVERSATION_LIMIT) {
      kept.push(conversation);
      loose += 1;
    }
  }

  return kept;
}

const initial = emptyConversation();

export const useAssistantStore = create<AssistantState>((set, get) => ({
  mode: 'idle',
  conversations: [initial],
  activeId: initial.id,
  pulseCount: 0,
  burstCount: 0,

  setMode: (mode) => set({ mode }),

  pulse: () => set((state) => ({ pulseCount: state.pulseCount + 1 })),

  celebrate: () => {
    set((state) => ({ mode: 'success', burstCount: state.burstCount + 1 }));

    setTimeout(() => {
      // Só voltar a repouso se entretanto ninguém mudou o modo — um pedido novo
      // durante a celebração tem prioridade sobre a celebração.
      if (get().mode === 'success') set({ mode: 'idle' });
    }, SUCCESS_MODE_DURATION_MS);
  },

  addMessage: (author, text, isStreaming = false) => {
    const message: AssistantMessage = {
      id: createId('msg'),
      author,
      text,
      createdAt: Date.now(),
      isStreaming,
      isFavourite: false,
    };

    set((state) => ({
      conversations: state.conversations.map((conversation) => {
        if (conversation.id !== state.activeId) return conversation;

        // O título vem do primeiro pedido de quem escreve. A saudação de
        // abertura, que é do assistente, não dá nome à conversa.
        const shouldName =
          conversation.title === UNTITLED_CONVERSATION && author === 'user' && text.length > 0;

        const allMessages = [...conversation.messages, message];
        // Manter só as últimas MSG_LIMIT — a primeira nunca cai (é o título).
        const trimmed: readonly AssistantMessage[] = allMessages.length > MSG_LIMIT
          ? [allMessages[0]!, ...allMessages.slice(-(MSG_LIMIT - 1))]
          : allMessages;

        return {
          ...conversation,
          title: shouldName ? titleFrom(text) : conversation.title,
          updatedAt: message.createdAt,
          messages: trimmed,
        };
      }),
    }));

    void get().persist();
    return message.id;
  },

  appendToMessage: (id, chunk) =>
    set((state) => ({
      conversations: mapActive(state, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === id ? { ...message, text: message.text + chunk } : message,
        ),
      })),
    })),

  finishMessage: (id) => {
    set((state) => ({
      conversations: mapActive(state, (conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        messages: conversation.messages.map((message) =>
          message.id === id ? { ...message, isStreaming: false } : message,
        ),
      })),
    }));

    // Só se grava no fim: gravar a cada carácter escreveria centenas de vezes
    // por resposta.
    void get().persist();
  },

  toggleFavourite: (id) => {
    set((state) => ({
      conversations: mapActive(state, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === id ? { ...message, isFavourite: !message.isFavourite } : message,
        ),
      })),
    }));

    void get().persist();
  },

  noteModel: (id, model) =>
    set((state) => ({
      conversations: mapActive(state, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === id ? { ...message, model } : message,
        ),
      })),
    })),

  removeMessage: (id) => {
    set((state) => ({
      conversations: mapActive(state, (conversation) => ({
        ...conversation,
        messages: conversation.messages.filter((message) => message.id !== id),
      })),
    }));
  },

  rewindToPrompt: (messageId) => {
    const state = get();
    const conversation = state.conversations.find((entry) => entry.id === state.activeId);
    if (!conversation) return null;

    const index = conversation.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return null;

    // O pedido é a última mensagem de quem escreve antes desta resposta.
    let promptIndex = -1;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (conversation.messages[cursor]?.author === 'user') {
        promptIndex = cursor;
        break;
      }
    }

    const prompt = conversation.messages[promptIndex]?.text;
    if (promptIndex < 0 || prompt === undefined) return null;

    set({
      conversations: mapActive(state, (entry) => ({
        ...entry,
        messages: entry.messages.slice(0, promptIndex),
      })),
    });

    return prompt;
  },

  startConversation: () => {
    const conversation = emptyConversation();

    set((state) => {
      // Uma conversa vazia não se acumula: pedir uma nova duas vezes seguidas
      // deixaria um rasto de conversas sem nada.
      const existing = state.conversations.filter(
        (entry) => entry.messages.length > 0 || entry.isPinned,
      );

      return {
        conversations: withinLimit([conversation, ...existing], conversation.id),
        activeId: conversation.id,
      };
    });

    void get().persist();
    return conversation.id;
  },

  selectConversation: (id) => {
    if (!get().conversations.some((entry) => entry.id === id)) return;
    set({ activeId: id });
  },

  togglePinned: (id) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id
          ? { ...conversation, isPinned: !conversation.isPinned }
          : conversation,
      ),
    }));

    void get().persist();
  },

  removeConversation: (id) => {
    set((state) => {
      const remaining = state.conversations.filter((conversation) => conversation.id !== id);

      // Apagar a conversa ativa deixa uma nova aberta em vez de um vazio sem
      // sítio onde escrever.
      if (remaining.length === 0) {
        const fresh = emptyConversation();
        return { conversations: [fresh], activeId: fresh.id };
      }

      const activeId =
        state.activeId === id ? (sortConversations(remaining)[0]?.id ?? state.activeId) : state.activeId;

      return { conversations: remaining, activeId };
    });

    void get().persist();
  },

  reset: () => {
    const fresh = emptyConversation();
    set({ conversations: [fresh], activeId: fresh.id, mode: 'idle' });
    void get().persist();
  },

  persist: async () => {
    const state = get();
    await storageService.set(STORAGE_KEYS.conversations, {
      conversations: state.conversations,
      activeId: state.activeId,
    });
  },

  hydrate: async () => {
    const saved = await storageService.get<{
      conversations: AssistantConversation[];
      activeId: string;
    } | null>(STORAGE_KEYS.conversations, null);

    const conversations = saved?.conversations ?? [];
    if (conversations.length === 0) return;

    // Uma resposta a meio quando se fechou a aplicação ficaria a piscar o
    // cursor para sempre: ao ler, nada está a ser escrito.
    const settled = conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({ ...message, isStreaming: false })),
    }));

    const activeId =
      saved?.activeId !== undefined && settled.some((entry) => entry.id === saved.activeId)
        ? saved.activeId
        : (sortConversations(settled)[0]?.id ?? '');

    set({ conversations: settled, activeId });
  },
}));

/** As mensagens da conversa ativa. */
export function selectMessages(state: AssistantState): readonly AssistantMessage[] {
  return state.conversations.find((entry) => entry.id === state.activeId)?.messages ?? [];
}

/** A conversa ativa. `null` nunca acontece na prática — há sempre uma. */
export function selectActiveConversation(state: AssistantState): AssistantConversation | null {
  return state.conversations.find((entry) => entry.id === state.activeId) ?? null;
}

/** Aplica uma transformação só à conversa ativa. */
function mapActive(
  state: AssistantState,
  transform: (conversation: AssistantConversation) => AssistantConversation,
): readonly AssistantConversation[] {
  return state.conversations.map((conversation) =>
    conversation.id === state.activeId ? transform(conversation) : conversation,
  );
}
