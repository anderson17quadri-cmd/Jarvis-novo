import { create } from 'zustand';

import { createId } from '@/lib/id';
import { SUCCESS_MODE_DURATION_MS } from '@/types/assistant';
import type { AssistantMessage, AssistantMode } from '@/types/assistant';

interface AssistantState {
  mode: AssistantMode;
  messages: readonly AssistantMessage[];
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
  reset: () => void;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  mode: 'idle',
  messages: [],
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
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return message.id;
  },

  appendToMessage: (id, chunk) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, text: message.text + chunk } : message,
      ),
    })),

  finishMessage: (id) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, isStreaming: false } : message,
      ),
    })),

  reset: () => set({ messages: [], mode: 'idle' }),
}));
