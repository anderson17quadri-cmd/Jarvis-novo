import { create } from 'zustand';

import { storageService, STORAGE_KEYS } from '@/services/storage-service';

/** Fases por que a aplicação passa desde que abre. */
export type SessionPhase = 'booting' | 'login' | 'desktop';

interface SessionState {
  phase: SessionPhase;
  /** Passa ao login quando a sequência de arranque acaba. */
  completeBoot: () => void;
  /** Passa ao desktop quando a identidade é confirmada. */
  authenticate: () => void;
  /**
   * Termina a sessão e volta ao login.
   *
   * O arranque não se repete: a flag `booted` fica guardada, por isso quem
   * termina a sessão vê o login e não os dez passos outra vez.
   */
  logout: () => void;
  /**
   * Repõe a sequência de arranque completa e recarrega.
   *
   * Vive aqui, e não em quem chama, porque tem dois pontos de entrada — a
   * Command Palette e a janela de Personalização (Parte 4 §Pular boot). Duas
   * cópias divergiriam à primeira alteração.
   */
  restartBootSequence: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  phase: 'booting',
  completeBoot: () => set({ phase: 'login' }),
  authenticate: () => set({ phase: 'desktop' }),
  logout: () => set({ phase: 'login' }),

  restartBootSequence: async () => {
    await storageService.set(STORAGE_KEYS.booted, false);
    // Recarregar é a forma honesta de reiniciar: garante que tudo — canvas,
    // temporizadores, serviços — volta ao estado de arranque, em vez de
    // remontar componentes por cima de estado antigo.
    window.location.reload();
  },
}));
