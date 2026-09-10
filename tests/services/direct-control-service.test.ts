import { beforeEach, describe, expect, it, vi } from 'vitest';

import { directControlService, type ControlStep } from '@/services/direct-control-service';

/**
 * Controlo direto, Fase 3.1 (`docs/spec/fase-3-controlo-direto.md`).
 *
 * Nunca tinha tido nenhum teste — apanhado numa revisão de segurança a
 * sério (13/08/2026) na peça de maior risco do projeto. O achado principal:
 * `executeStep` nunca conferia se havia uma sessão de presença ativa antes
 * de executar a sério — a spec diz "sem isto, nada corre", mas isso só
 * valia enquanto quem chamasse `executeStep` se lembrasse de verificar
 * `sessionActive` primeiro. Nada no código de produção sequer chama
 * `executeStep` hoje (a Fase 3.1 está construída mas nunca ligada a um
 * fluxo alcançável pela pessoa) — mas o serviço tinha de se defender
 * sozinho, para o dia em que uma sub-fase futura o ligar.
 */

function makeStep(overrides: Partial<ControlStep> = {}): ControlStep & { readonly calls: number } {
  let calls = 0;
  const step = {
    id: 'passo-1',
    description: 'Abrir o Bloco de Notas',
    risk: 'baixo' as const,
    execute: () => {
      calls += 1;
    },
    ...overrides,
  };
  return Object.defineProperty(step, 'calls', { get: () => calls }) as ControlStep & { readonly calls: number };
}

beforeEach(() => {
  directControlService.setEnabled(false);
  // Limpa um passo pendente que um teste anterior tenha deixado a meio — sem
  // isto, o overlay de um teste passado ficava a espreitar o seguinte.
  directControlService.cancel();
  directControlService.setSimulated(true);
  directControlService.clearHistory();
  directControlService.endSession();
});

describe('palavra-passe', () => {
  it('sem palavra-passe definida, nada verifica', async () => {
    expect(directControlService.hasPassword).toBe(false);
    expect(await directControlService.verify('qualquer coisa')).toBe(false);
  });

  it('a frase certa verifica; qualquer outra não', async () => {
    await directControlService.setPassword('abre-te sesamo');

    expect(await directControlService.verify('abre-te sesamo')).toBe(true);
    expect(await directControlService.verify('Abre-te Sesamo')).toBe(false);
    expect(await directControlService.verify('abre-te sesam')).toBe(false);
  });
});

describe('sessão de presença', () => {
  it('sem sessão iniciada, sessionActive é falso', () => {
    expect(directControlService.sessionActive).toBe(false);
  });

  it('startSession abre uma sessão ativa; endSession fecha-a', () => {
    directControlService.startSession();
    expect(directControlService.sessionActive).toBe(true);

    directControlService.endSession();
    expect(directControlService.sessionActive).toBe(false);
  });

  it('desligar o controlo direto fecha qualquer sessão ativa', () => {
    directControlService.setEnabled(true);
    directControlService.startSession();
    expect(directControlService.sessionActive).toBe(true);

    directControlService.setEnabled(false);
    expect(directControlService.sessionActive).toBe(false);
  });

  it('a sessão expira sozinha ao fim da duração configurada', () => {
    vi.useFakeTimers();
    try {
      directControlService.sessionDurationMinutes = 30;
      directControlService.startSession();
      expect(directControlService.sessionActive).toBe(true);

      vi.advanceTimersByTime(30 * 60_000 + 1);
      expect(directControlService.sessionActive).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('executeStep — a porta de presença', () => {
  it('nunca executa em modo simulado, mesmo com sessão ativa e confirmado', () => {
    directControlService.setEnabled(true);
    directControlService.setSimulated(true);
    directControlService.startSession();

    const step = makeStep();
    directControlService.executeStep(step, true);

    expect(step.calls).toBe(0);
  });

  it('nunca executa sem confirmação, mesmo fora do modo simulado', () => {
    directControlService.setEnabled(true);
    directControlService.setSimulated(false);
    directControlService.startSession();

    const step = makeStep();
    directControlService.executeStep(step, false);

    expect(step.calls).toBe(0);
  });

  it('recusa executar sem uma sessão de presença ativa — mesmo confirmado e fora do modo simulado', () => {
    // O caso central: nunca se chamou startSession(). Sem esta verificação
    // dentro do próprio executeStep, isto executaria.
    directControlService.setEnabled(true);
    directControlService.setSimulated(false);

    const step = makeStep();
    directControlService.executeStep(step, true);

    expect(step.calls).toBe(0);
  });

  it('recusa executar com o controlo direto desligado, mesmo com os outros três fatores a bater certo', () => {
    directControlService.setSimulated(false);
    directControlService.startSession(); // startSession não liga o interruptor sozinho
    directControlService.setEnabled(false);

    const step = makeStep();
    directControlService.executeStep(step, true);

    expect(step.calls).toBe(0);
  });

  it('executa a sério só com os quatro fatores: ligado, sessão ativa, confirmado, não simulado', () => {
    directControlService.setEnabled(true);
    directControlService.setSimulated(false);
    directControlService.startSession();

    const step = makeStep();
    directControlService.executeStep(step, true);

    expect(step.calls).toBe(1);
  });

  it('um passo que rebenta ao executar fica registado no log, sem propagar o erro', () => {
    directControlService.setEnabled(true);
    directControlService.setSimulated(false);
    directControlService.startSession();

    const step = makeStep({
      execute: () => {
        throw new Error('falhou a sério');
      },
    });

    expect(() => directControlService.executeStep(step, true)).not.toThrow();
  });

  it('todo o passo fica no histórico, mesmo recusado ou bloqueado pela porta', () => {
    const step = makeStep();
    directControlService.executeStep(step, false);

    expect(directControlService.history).toHaveLength(1);
    expect(directControlService.history[0]?.wasConfirmed).toBe(false);
  });
});

describe('requestStep — o pedido que atravessa o overlay', () => {
  it('com o controlo direto desligado, recusa e não põe nada no overlay', () => {
    const step = makeStep();
    const message = directControlService.requestStep(step);

    expect(message).toMatch(/desligado/);
    expect(directControlService.pending).toBeNull();
    expect(step.calls).toBe(0);
  });

  it('ligado mas sem sessão ativa, recusa e não põe nada no overlay', () => {
    directControlService.setEnabled(true);

    const step = makeStep();
    const message = directControlService.requestStep(step);

    expect(message).toMatch(/sessão/);
    expect(directControlService.pending).toBeNull();
    expect(step.calls).toBe(0);
  });

  it('ligado e com sessão ativa, fica à espera de confirmação no overlay', () => {
    directControlService.setEnabled(true);
    directControlService.startSession();

    const step = makeStep();
    const message = directControlService.requestStep(step);

    expect(message).toMatch(/confirmação/);
    expect(directControlService.pending).toBe(step);
    // Ainda não executou — só fica à espera.
    expect(step.calls).toBe(0);
  });

  it('confirmar executa o passo e esvazia o overlay', () => {
    directControlService.setEnabled(true);
    directControlService.setSimulated(false);
    directControlService.startSession();

    const step = makeStep();
    directControlService.requestStep(step);
    directControlService.confirm();

    expect(step.calls).toBe(1);
    expect(directControlService.pending).toBeNull();
    expect(directControlService.history[0]?.wasConfirmed).toBe(true);
  });

  it('recusar não executa nada, mas fica registado como recusado', () => {
    directControlService.setEnabled(true);
    directControlService.setSimulated(false);
    directControlService.startSession();

    const step = makeStep();
    directControlService.requestStep(step);
    directControlService.cancel();

    expect(step.calls).toBe(0);
    expect(directControlService.pending).toBeNull();
    expect(directControlService.history[0]?.wasConfirmed).toBe(false);
  });
});

describe('emergencyStop — o travão de mão (Esc Esc)', () => {
  it('cancela o passo pendente e termina a sessão, sem executar nada', () => {
    directControlService.setEnabled(true);
    directControlService.startSession();

    const step = makeStep();
    directControlService.requestStep(step);
    expect(directControlService.pending).toBe(step);

    directControlService.emergencyStop();

    expect(directControlService.pending).toBeNull();
    expect(directControlService.sessionActive).toBe(false);
    expect(step.calls).toBe(0);
  });

  it('termina a sessão mesmo sem passo pendente', () => {
    directControlService.setEnabled(true);
    directControlService.startSession();

    directControlService.emergencyStop();

    expect(directControlService.sessionActive).toBe(false);
  });

  it('sem sessão nem passo pendente, é um não-acontecimento — não rebenta', () => {
    expect(() => directControlService.emergencyStop()).not.toThrow();
    expect(directControlService.pending).toBeNull();
    expect(directControlService.sessionActive).toBe(false);
  });
});
