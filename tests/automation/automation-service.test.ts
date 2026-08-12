import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { seedAutomations } from '@/data/automations';
import {
  AutomationService,
  matchesCondition,
  type AutomationExecutor,
} from '@/services/automation-service';
import { eventBus } from '@/services/event-bus';
import type { Automation } from '@/types/automation';

function makeExecutor(): AutomationExecutor & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    openWindow: (appId) => calls.push(`janela:${appId}`),
    notify: (title) => calls.push(`aviso:${title}`),
    setTheme: (theme) => calls.push(`tema:${theme}`),
    setSystemState: (state) => calls.push(`estado:${state}`),
    setWidgetVisible: (widget, show) => calls.push(`widget:${widget}:${show ? 'on' : 'off'}`),
    speak: (text) => calls.push(`voz:${text}`),
  };
}

/** Uma automação mínima, com o que o teste precisar por cima. */
function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'a1',
    name: 'Teste',
    description: '',
    trigger: { kind: 'manual' },
    conditions: [],
    actions: [{ kind: 'notificar', title: 'Olá', description: '' }],
    isEnabled: true,
    createdAt: 0,
    lastRunAt: null,
    runCount: 0,
    ...overrides,
  };
}

let service: AutomationService;
let executor: ReturnType<typeof makeExecutor>;
let now: Date;

beforeEach(async () => {
  localStorage.clear();
  eventBus.clear();
  now = new Date('2026-07-28T10:00:00');
  service = new AutomationService();
  executor = makeExecutor();
  await service.hydrate([]);
  service.start(executor, () => ({ now, systemState: 'normal' }));
});

afterEach(() => {
  service.stop();
  vi.useRealTimers();
});

describe('execução', () => {
  it('corre as ações pela ordem em que estão escritas', () => {
    const automation = service.add(
      makeAutomation({
        actions: [
          { kind: 'tema', theme: 'oled' },
          { kind: 'estado-sistema', state: 'foco' },
          { kind: 'falar', text: 'pronto' },
        ],
      }),
    );

    service.run(automation.id);

    expect(executor.calls).toEqual(['tema:oled', 'estado:foco', 'voz:pronto']);
  });

  it('regista o resultado no histórico', () => {
    const automation = service.add(makeAutomation());
    service.run(automation.id);

    const [run] = service.history;
    expect(run?.result).toBe('ok');
    expect(run?.automationName).toBe('Teste');
  });

  it('uma ação que rebenta pára a execução e diz em qual foi', () => {
    const partido: AutomationExecutor = {
      ...executor,
      setTheme: () => {
        throw new Error('sem tema');
      },
    };
    service.stop();
    service.start(partido, () => ({ now, systemState: 'normal' }));

    const automation = service.add(
      makeAutomation({
        actions: [
          { kind: 'notificar', title: 'primeira', description: '' },
          { kind: 'tema', theme: 'oled' },
          { kind: 'falar', text: 'nunca chega aqui' },
        ],
      }),
    );

    service.run(automation.id);

    const [run] = service.history;
    expect(run?.result).toBe('erro');
    expect(run?.message).toContain('ação 2');
  });

  it('só uma execução a sério conta para o contador', () => {
    const automation = service.add(
      makeAutomation({ conditions: [{ kind: 'estado-sistema', state: 'foco' }] }),
    );

    // O sistema está em `normal`: a condição falha.
    service.run(automation.id);

    expect(service.list[0]?.runCount).toBe(0);
    expect(service.history[0]?.result).toBe('condicoes-nao-cumpridas');
  });

  it('executar à mão salta as condições — senão o botão parecia avariado', () => {
    const automation = service.add(
      makeAutomation({ conditions: [{ kind: 'estado-sistema', state: 'apresentacao' }] }),
    );

    service.run(automation.id, true);

    expect(service.history[0]?.result).toBe('ok');
    expect(executor.calls).toHaveLength(1);
  });
});

describe('gatilhos por evento', () => {
  it('uma regra ligada corre quando o evento acontece', () => {
    service.add(
      makeAutomation({
        trigger: { kind: 'evento', event: 'email:novo' },
        actions: [{ kind: 'falar', text: 'chegou' }],
      }),
    );
    // O motor só escuta os eventos que as regras usam — reiniciar reavalia.
    service.stop();
    service.start(executor, () => ({ now, systemState: 'normal' }));

    eventBus.emit('email:novo', { from: 'a', subject: 'b' });

    expect(executor.calls).toEqual(['voz:chegou']);
  });

  it('uma regra desligada não corre', () => {
    service.add(
      makeAutomation({ trigger: { kind: 'evento', event: 'email:novo' }, isEnabled: false }),
    );
    service.stop();
    service.start(executor, () => ({ now, systemState: 'normal' }));

    eventBus.emit('email:novo', { from: 'a', subject: 'b' });

    expect(executor.calls).toHaveLength(0);
  });

  it('parar o motor cancela as subscrições', () => {
    service.add(makeAutomation({ trigger: { kind: 'evento', event: 'email:novo' } }));
    service.stop();
    service.start(executor, () => ({ now, systemState: 'normal' }));
    service.stop();

    eventBus.emit('email:novo', { from: 'a', subject: 'b' });

    expect(executor.calls).toHaveLength(0);
  });
});

describe('condições', () => {
  const context = { now: new Date('2026-07-28T10:00:00'), systemState: 'normal' };

  it('dia da semana', () => {
    // 28 de julho de 2026 é uma terça-feira.
    expect(matchesCondition({ kind: 'dia-da-semana', days: [2] }, context)).toBe(true);
    expect(matchesCondition({ kind: 'dia-da-semana', days: [0, 6] }, context)).toBe(false);
  });

  it('faixa horária normal', () => {
    expect(matchesCondition({ kind: 'faixa-horaria', fromHour: 9, toHour: 18 }, context)).toBe(true);
    expect(matchesCondition({ kind: 'faixa-horaria', fromHour: 14, toHour: 18 }, context)).toBe(
      false,
    );
  });

  it('faixa horária que atravessa a meia-noite', () => {
    const noite = { now: new Date('2026-07-28T23:30:00'), systemState: 'normal' };
    const madrugada = { now: new Date('2026-07-28T03:00:00'), systemState: 'normal' };

    // 22h → 6h tem de valer dos dois lados da meia-noite.
    expect(matchesCondition({ kind: 'faixa-horaria', fromHour: 22, toHour: 6 }, noite)).toBe(true);
    expect(matchesCondition({ kind: 'faixa-horaria', fromHour: 22, toHour: 6 }, madrugada)).toBe(
      true,
    );
    expect(matchesCondition({ kind: 'faixa-horaria', fromHour: 22, toHour: 6 }, context)).toBe(
      false,
    );
  });

  it('estado do sistema', () => {
    expect(matchesCondition({ kind: 'estado-sistema', state: 'normal' }, context)).toBe(true);
    expect(matchesCondition({ kind: 'estado-sistema', state: 'foco' }, context)).toBe(false);
  });
});

describe('persistência', () => {
  it('as regras e o histórico sobrevivem a recarregar', async () => {
    const automation = service.add(makeAutomation({ name: 'Guardada' }));
    service.run(automation.id);
    await service.persist();

    const outro = new AutomationService();
    await outro.hydrate([]);

    expect(outro.list[0]?.name).toBe('Guardada');
    expect(outro.history).toHaveLength(1);
  });

  it('apagar tudo e recarregar não traz os exemplos de volta', async () => {
    const automation = service.add(makeAutomation());
    service.remove(automation.id);
    await service.persist();

    const outro = new AutomationService();
    await outro.hydrate(seedAutomations());

    expect(outro.list).toHaveLength(0);
  });

  it('sem nada guardado, começa com os exemplos', async () => {
    const outro = new AutomationService();
    await outro.hydrate(seedAutomations());

    expect(outro.list).toHaveLength(seedAutomations().length);
  });
});

describe('exemplos', () => {
  it('vêm todos desligados — nada corre sem alguém o ligar', () => {
    for (const automation of seedAutomations()) {
      expect(automation.isEnabled, automation.name).toBe(false);
    }
  });

  it('nenhum usa gatilhos ou ações que o sistema não saiba cumprir', () => {
    const gatilhos = new Set(['hora', 'intervalo', 'evento', 'manual']);
    const acoes = new Set(['abrir-janela', 'notificar', 'tema', 'estado-sistema', 'widget', 'falar']);

    for (const automation of seedAutomations()) {
      expect(gatilhos.has(automation.trigger.kind)).toBe(true);
      for (const action of automation.actions) expect(acoes.has(action.kind)).toBe(true);
    }
  });
});

describe('gatilhos nativos (checkNativeTriggers)', () => {
  it('ficheiros: dispara quando o caminho está dentro da pasta observada', () => {
    service.add(
      makeAutomation({
        trigger: { kind: 'ficheiros', folderPath: 'C:/Utilizadores/Anderson/Documentos' },
      }),
    );

    service.checkNativeTriggers('ficheiros', {
      filePath: 'C:/Utilizadores/Anderson/Documentos/nota.txt',
    });

    expect(executor.calls).toEqual(['aviso:Olá']);
  });

  it('ficheiros: não dispara para um caminho fora da pasta observada', () => {
    service.add(
      makeAutomation({ trigger: { kind: 'ficheiros', folderPath: 'C:/Documentos/Propostas' } }),
    );

    service.checkNativeTriggers('ficheiros', { filePath: 'C:/Documentos/Outra/ficheiro.txt' });

    expect(executor.calls).toEqual([]);
  });

  it('ficheiros: ignora maiúsculas e barras invertidas ao comparar', () => {
    service.add(
      makeAutomation({ trigger: { kind: 'ficheiros', folderPath: 'C:/Documentos/Propostas' } }),
    );

    service.checkNativeTriggers('ficheiros', {
      filePath: 'C:\\DOCUMENTOS\\Propostas\\orçamento.pdf',
    });

    expect(executor.calls).toEqual(['aviso:Olá']);
  });

  it('usb: dispara só quando a ação corresponde (ligado vs desligado)', () => {
    service.add(makeAutomation({ trigger: { kind: 'usb', action: 'ligado' } }));

    service.checkNativeTriggers('usb', { usbAction: 'desligado' });
    expect(executor.calls).toEqual([]);

    service.checkNativeTriggers('usb', { usbAction: 'ligado' });
    expect(executor.calls).toEqual(['aviso:Olá']);
  });

  it('bateria: dispara ao cruzar o limiar por baixo, não antes de haver uma leitura anterior', () => {
    service.add(
      makeAutomation({ trigger: { kind: 'bateria', direction: 'abaixo', percent: 20 } }),
    );

    // Primeira leitura: não há "anterior" para comparar, nunca dispara à
    // primeira — senão uma bateria que já nasce a 15% disparava sem ter
    // cruzado nada.
    service.checkNativeTriggers('bateria', { batteryPercent: 15 });
    expect(executor.calls).toEqual([]);

    service.checkNativeTriggers('bateria', { batteryPercent: 25 });
    expect(executor.calls).toEqual([]);

    service.checkNativeTriggers('bateria', { batteryPercent: 18 });
    expect(executor.calls).toEqual(['aviso:Olá']);
  });

  it('bateria: dispara ao cruzar o limiar por cima', () => {
    service.add(makeAutomation({ trigger: { kind: 'bateria', direction: 'acima', percent: 80 } }));

    service.checkNativeTriggers('bateria', { batteryPercent: 70 });
    service.checkNativeTriggers('bateria', { batteryPercent: 85 });

    expect(executor.calls).toEqual(['aviso:Olá']);
  });

  it('bateria: não dispara outra vez enquanto o nível se mantém do mesmo lado do limiar', () => {
    service.add(
      makeAutomation({ trigger: { kind: 'bateria', direction: 'abaixo', percent: 20 } }),
    );

    service.checkNativeTriggers('bateria', { batteryPercent: 25 });
    service.checkNativeTriggers('bateria', { batteryPercent: 18 });
    service.checkNativeTriggers('bateria', { batteryPercent: 15 });

    expect(executor.calls).toEqual(['aviso:Olá']);
  });

  it('gatilhos de tipos diferentes não se confundem uns aos outros', () => {
    service.add(makeAutomation({ trigger: { kind: 'usb', action: 'ligado' } }));

    service.checkNativeTriggers('ficheiros', { filePath: 'C:/qualquer' });
    service.checkNativeTriggers('bateria', { batteryPercent: 5 });

    expect(executor.calls).toEqual([]);
  });
});
