import { beforeEach, describe, expect, it } from 'vitest';

import { directControlService } from '@/services/direct-control-service';
import { useSessionStore } from '@/stores/use-session-store';

/**
 * A spec do Controlo Direto (`docs/spec/fase-3-controlo-direto.md` §1.1) é
 * explícita:
 *
 * > **Liga-se ao bloqueio por inatividade que já existe** (Parte 14): se o
 * > ecrã bloquear por inatividade a meio dos 30 minutos, a sessão de controlo
 * > fecha imediatamente também, sem esperar pelo temporizador próprio — cobre
 * > o caso de teres saído do sítio.
 *
 * O `logout()` é o ponto único por onde a sessão acaba — o bloqueio por
 * inatividade (`useIdleLock` → `onLock` no `App.tsx`) e o sair à mão passam os
 * dois por aqui. Fechar a sessão de controlo **aqui**, e não em quem chama,
 * é a mesma disciplina que corrigiu o `executeStep` em 13/08: a fronteira vive
 * na função, não na memória de quem a invoca.
 */
describe('logout — a sessão de controlo direto não sobrevive ao bloqueio', () => {
  beforeEach(() => {
    directControlService.setEnabled(false);
    directControlService.endSession();
    useSessionStore.setState({ phase: 'desktop' });
  });

  it('sair da sessão fecha também a sessão de controlo direto', () => {
    directControlService.setEnabled(true);
    directControlService.startSession();
    expect(directControlService.sessionActive).toBe(true);

    useSessionStore.getState().logout();

    expect(directControlService.sessionActive).toBe(false);
  });

  it('sem sessão de controlo aberta, sair continua a funcionar na mesma', () => {
    expect(directControlService.sessionActive).toBe(false);

    useSessionStore.getState().logout();

    expect(useSessionStore.getState().phase).toBe('login');
    expect(directControlService.sessionActive).toBe(false);
  });
});
