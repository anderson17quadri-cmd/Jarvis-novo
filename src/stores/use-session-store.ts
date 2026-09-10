import { create } from 'zustand';

import { clearAutoLoginSession } from '@/services/auto-login-service';
import { directControlService } from '@/services/direct-control-service';
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
   * termina a sessão vê o login e não os dez passos outra vez. Também apaga
   * a sessão automática do Windows Hello — sem isto, sair "a sério" cairia
   * logo de volta ao desktop sozinho na vez seguinte.
   *
   * **E fecha a sessão de Controlo Direto**, que a spec
   * (`docs/spec/fase-3-controlo-direto.md` §1.1) manda fechar junto com o
   * bloqueio: "se o ecrã bloquear por inatividade a meio dos 30 minutos, a
   * sessão de controlo fecha imediatamente também — cobre o caso de teres
   * saído do sítio". Fica aqui, e não em quem chama, porque este é o ponto
   * único por onde a sessão acaba (o bloqueio por inatividade e o sair à mão
   * passam os dois por cá) — deixá-lo ao critério do chamador é exatamente o
   * que deixou o `executeStep` sem porta até 13/08.
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
  logout: () => {
    void clearAutoLoginSession();
    directControlService.endSession();
    set({ phase: 'login' });
  },

  restartBootSequence: async () => {
    await storageService.set(STORAGE_KEYS.booted, false);
    // Recarregar é a forma honesta de reiniciar: garante que tudo — canvas,
    // temporizadores, serviços — volta ao estado de arranque, em vez de
    // remontar componentes por cima de estado antigo.
    window.location.reload();
  },
}));
