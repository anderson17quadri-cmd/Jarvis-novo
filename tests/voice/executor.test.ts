import { beforeEach, describe, expect, it } from 'vitest';

import {
  executeIntent,
  runIntent,
  setVoiceExecutor,
  type VoiceExecutor,
} from '@/services/voice/executor';
import { parseSpeech } from '@/services/voice/intents';

function makeExecutor(): VoiceExecutor & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    openWindow: (appId) => calls.push(`janela:${appId}`),
    closeAllWindows: () => calls.push('fechar-tudo'),
    setTheme: (theme) => calls.push(`tema:${theme}`),
    setSystemState: (state) => calls.push(`estado:${state}`),
    setWidgetVisible: (widget, show) => calls.push(`widget:${widget}:${show ? 'on' : 'off'}`),
    hideAllWidgets: () => calls.push('esconder-widgets'),
    createTask: (title) => calls.push(`tarefa:${title}`),
    search: (query) => calls.push(`procurar:${query}`),
    music: (action) => calls.push(`musica:${action}`),
    restartInterface: () => calls.push('reiniciar'),
    ask: (text) => calls.push(`perguntar:${text}`),
  };
}

let executor: ReturnType<typeof makeExecutor>;

beforeEach(() => {
  executor = makeExecutor();
});

/** Diz uma frase e devolve o que o sistema fez. */
function say(phrase: string): readonly string[] {
  for (const intent of parseSpeech(phrase).intents) executeIntent(intent, executor);
  return executor.calls;
}

describe('da frase à ação', () => {
  it('abrir uma janela', () => {
    expect(say('Abre o calendário')).toEqual(['janela:calendar']);
  });

  it('trocar de tema', () => {
    expect(say('Muda para o tema emerald')).toEqual(['tema:emerald']);
  });

  it('entrar em modo foco', () => {
    expect(say('Ativa o modo foco')).toEqual(['estado:foco']);
  });

  it('criar uma tarefa', () => {
    expect(say('Cria uma tarefa rever o orçamento')).toEqual(['tarefa:rever o orcamento']);
  });

  it('procurar', () => {
    expect(say('Procura relatório semanal')).toEqual(['procurar:relatorio semanal']);
  });

  it('controlar a música', () => {
    expect(say('Próxima faixa')).toEqual(['musica:proxima']);
  });

  it('uma pergunta vai ao assistente com o texto original', () => {
    expect(say('Que horas são em Tóquio?')).toEqual(['perguntar:Que horas são em Tóquio?']);
  });

  it('uma frase composta executa tudo, pela ordem em que foi dita', () => {
    expect(say('Abre os emails e ativa o modo apresentação')).toEqual([
      'janela:emails',
      'estado:apresentacao',
    ]);
  });
});

describe('executor em vigor', () => {
  it('sem ninguém registado, não rebenta — apenas não acontece nada', () => {
    expect(() => runIntent({ kind: 'fechar-janelas' })).not.toThrow();
  });

  it('registado, executa', () => {
    const off = setVoiceExecutor(executor);
    runIntent({ kind: 'fechar-janelas' });

    expect(executor.calls).toEqual(['fechar-tudo']);
    off();
  });

  it('retirar o registo pára a execução', () => {
    const off = setVoiceExecutor(executor);
    off();
    runIntent({ kind: 'fechar-janelas' });

    expect(executor.calls).toHaveLength(0);
  });

  it('retirar um registo antigo não desliga o novo', () => {
    const primeiro = makeExecutor();
    const offPrimeiro = setVoiceExecutor(primeiro);
    const offSegundo = setVoiceExecutor(executor);

    // O primeiro sai de cena depois de o segundo já ter entrado.
    offPrimeiro();
    runIntent({ kind: 'fechar-janelas' });

    expect(executor.calls).toEqual(['fechar-tudo']);
    expect(primeiro.calls).toHaveLength(0);
    offSegundo();
  });
});
