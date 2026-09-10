import { describe, expect, it } from 'vitest';

import { describeContext, greetingFor, readContext, setContextSource } from '@/services/assistant/context';
import type { AssistantContext } from '@/types/assistant';

function makeContext(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    now: new Date(2026, 6, 28, 9, 5),
    userName: 'Anderson',
    weather: null,
    openWindows: [],
    unreadNotifications: 0,
    systemState: 'normal',
    theme: 'classic',
    ...overrides,
  };
}

describe('saudação', () => {
  it.each([
    [3, 'Boa madrugada'],
    [9, 'Bom dia'],
    [15, 'Boa tarde'],
    [22, 'Boa noite'],
  ])('às %i horas diz "%s"', (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe('fonte de contexto', () => {
  it('sem fonte registada não há contexto — e não se inventa um', () => {
    expect(readContext()).toBeNull();
  });

  it('lê o que a fonte devolver', () => {
    const stop = setContextSource(() => makeContext({ theme: 'oled' }));

    expect(readContext()?.theme).toBe('oled');
    stop();
    expect(readContext()).toBeNull();
  });

  it('desligar uma fonte antiga não apaga a que veio a seguir', () => {
    const stopFirst = setContextSource(() => makeContext({ theme: 'primeira' }));
    setContextSource(() => makeContext({ theme: 'segunda' }));

    stopFirst();

    expect(readContext()?.theme).toBe('segunda');
  });
});

describe('descrição do presente', () => {
  it('diz sempre as horas', () => {
    expect(describeContext(makeContext())).toContain('São 09:05.');
  });

  it('não fala de janelas quando não há nenhuma aberta', () => {
    expect(describeContext(makeContext())).not.toContain('janela');
  });

  it('uma janela é singular, duas são plural e vêm nomeadas', () => {
    expect(describeContext(makeContext({ openWindows: ['Emails'] }))).toContain(
      'Tem aberta a janela Emails.',
    );
    expect(describeContext(makeContext({ openWindows: ['Emails', 'Tarefas'] }))).toContain(
      'Tem 2 janelas abertas: Emails, Tarefas.',
    );
  });

  it('conta as notificações por ler', () => {
    expect(describeContext(makeContext({ unreadNotifications: 3 }))).toContain(
      '3 notificações por ler',
    );
  });

  it('só menciona o estado do sistema quando não é o normal', () => {
    expect(describeContext(makeContext())).not.toContain('modo');
    expect(describeContext(makeContext({ systemState: 'foco' }))).toContain('modo foco');
  });

  it('inclui a meteorologia quando há leitura', () => {
    const text = describeContext(
      makeContext({ weather: { location: 'Porto', temperatureC: 21, label: 'Céu limpo' } }),
    );

    expect(text).toContain('Em Porto está 21° e céu limpo.');
  });
});
