import { create } from 'zustand';

import { createId } from '@/lib/id';
import type { AssistantMessage, AssistantMode } from '@/types/assistant';

interface AssistantState {
  mode: AssistantMode;
  messages: readonly AssistantMessage[];
  /** Um "ping" que o AI Core observa para desenhar uma onda a partir do centro. */
  pulseCount: number;

  setMode: (mode: AssistantMode) => void;
  pulse: () => void;
  addMessage: (author: AssistantMessage['author'], text: string, isStreaming?: boolean) => string;
  appendToMessage: (id: string, chunk: string) => void;
  finishMessage: (id: string) => void;
  reset: () => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  mode: 'idle',
  messages: [],
  pulseCount: 0,

  setMode: (mode) => set({ mode }),

  pulse: () => set((state) => ({ pulseCount: state.pulseCount + 1 })),

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
