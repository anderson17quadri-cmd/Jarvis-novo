import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from '@/services/event-bus';
import { filterLogs, LogService, LOG_LIMIT } from '@/services/log-service';

let logs: LogService;

beforeEach(() => {
  eventBus.clear();
  logs = new LogService();
});

describe('registo', () => {
  it('a entrada mais recente vem primeiro', () => {
    logs.log('info', 'sistema', 'primeira');
    logs.log('info', 'sistema', 'segunda');

    expect(logs.list[0]?.message).toBe('segunda');
  });

  it('avisa quem estiver a ouvir', () => {
    const listener = vi.fn();
    logs.subscribe(listener);

    logs.log('info', 'sistema', 'alguma coisa');

    expect(listener).toHaveBeenCalledOnce();
  });

  it('não cresce sem limite — seria o próprio problema que ajuda a diagnosticar', () => {
    for (let index = 0; index < LOG_LIMIT + 50; index += 1) {
      logs.log('debug', 'sistema', `entrada ${index}`);
    }

    expect(logs.list).toHaveLength(LOG_LIMIT);
    // As mais antigas é que saem.
    expect(logs.list[0]?.message).toBe(`entrada ${LOG_LIMIT + 49}`);
  });

  it('limpar esvazia', () => {
    logs.log('info', 'sistema', 'x');
    logs.clear();

    expect(logs.list).toHaveLength(0);
  });
});

describe('auditoria', () => {
  it('grava quem fez o quê e como correu', () => {
    logs.audit('Instalar o plugin spotify', 'executado');

    const [entry] = logs.list;
    expect(entry?.source).toBe('auditoria');
    expect(entry?.message).toContain('executado');
  });

  it('uma recusa fica como aviso, não como informação', () => {
    logs.audit('Permissão de microfone', 'recusado');
    expect(logs.list[0]?.level).toBe('aviso');
  });
});

describe('inspetor de eventos', () => {
  it('regista o que anda no Event Bus', () => {
    const stop = logs.watchEventBus();
    eventBus.emit('tema:alterado', { theme: 'oled' });

    expect(logs.list[0]?.source).toBe('evento');
    expect(logs.list[0]?.detail).toContain('oled');
    stop();
  });

  it('parar de escutar deixa de registar', () => {
    const stop = logs.watchEventBus();
    stop();
    eventBus.emit('tema:alterado', { theme: 'oled' });

    expect(logs.list).toHaveLength(0);
  });

  it('escutar duas vezes não duplica cada evento', () => {
    logs.watchEventBus();
    const stop = logs.watchEventBus();

    eventBus.emit('tema:alterado', { theme: 'solar' });

    expect(logs.list).toHaveLength(1);
    stop();
  });
});

describe('filtros', () => {
  beforeEach(() => {
    logs.log('erro', 'plataforma', 'falhou a leitura');
    logs.log('info', 'sistema', 'arranque concluído');
    logs.log('debug', 'evento', 'tema alterado', 'theme: oled');
  });

  it('por nível', () => {
    const found = filterLogs(logs.list, { levels: new Set(['erro']) });
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe('falhou a leitura');
  });

  it('por origem', () => {
    expect(filterLogs(logs.list, { sources: new Set(['evento']) })).toHaveLength(1);
  });

  it('por texto, incluindo o detalhe', () => {
    expect(filterLogs(logs.list, { query: 'oled' })).toHaveLength(1);
  });

  it('sem filtros devolve tudo', () => {
    expect(filterLogs(logs.list, {})).toHaveLength(3);
  });

  it('os filtros acumulam', () => {
    const found = filterLogs(logs.list, {
      levels: new Set(['debug']),
      query: 'tema',
    });
    expect(found).toHaveLength(1);
  });

  it('um conjunto vazio não filtra nada — é diferente de não haver correspondência', () => {
    expect(filterLogs(logs.list, { levels: new Set() })).toHaveLength(3);
  });
});
