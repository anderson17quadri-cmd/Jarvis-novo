import { create } from 'zustand';

/**
 * Correção do que a voz ouviu (Parte 10 §Correção de erros).
 *
 * Existe porque quem abre a caixa não é um componente: é a ação de uma
 * notificação, uma função criada dentro do `useVoice` e guardada num objeto.
 * Uma store é o caminho que o resto do projeto já usa para ligar código que
 * não está em React a interface que está.
 *
 * Não persiste. Uma frase mal ouvida não é história — é uma coisa a corrigir
 * agora, ou a deixar cair.
 */

interface VoiceCorrectionState {
  /** A frase a corrigir. `null` com a caixa fechada. */
  readonly phrase: string | null;
  /**
   * Sobe a cada abertura, e serve de `key` à caixa.
   *
   * Sem ele, ouvir a mesma frase duas vezes não remontava nada, e a caixa
   * reabria com a emenda da vez anterior lá dentro. A frase sozinha não chega
   * para distinguir duas aberturas.
   */
  readonly requestId: number;

  open: (phrase: string) => void;
  close: () => void;
}

export const useVoiceCorrectionStore = create<VoiceCorrectionState>((set) => ({
  phrase: null,
  requestId: 0,

  open: (phrase) => set((state) => ({ phrase, requestId: state.requestId + 1 })),
  close: () => set({ phrase: null }),
}));
