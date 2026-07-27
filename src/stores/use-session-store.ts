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
  /** Só para o comando "reiniciar sequência de arranque" da paleta. */
  resetBootFlag: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  phase: 'booting',
  completeBoot: () => set({ phase: 'login' }),
  authenticate: () => set({ phase: 'desktop' }),
  logout: () => set({ phase: 'login' }),
  resetBootFlag: async () => {
    await storageService.set(STORAGE_KEYS.booted, false);
  },
}));
