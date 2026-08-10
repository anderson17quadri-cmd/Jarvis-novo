import { beforeEach, describe, expect, it } from 'vitest';

import { AIService } from '@/services/ai-service';
import { setContextSource } from '@/services/assistant/context';
import { selectMessages, useAssistantStore } from '@/stores/use-assistant-store';
import { AiFailure, planFallback, type AiFailureKind } from '@/types/ai-failure';
import type { AiProvider } from '@/types/assistant';

/**
 * Regras de fallback (Parte 12).
 *
 * As regras são uma função pura — testam-se sem rede, sem stores e sem
 * relógio. Depois prova-se que o serviço as cumpre, com um provedor que falha
 * de propósito.
 */

/** Um provedor que rebenta sempre, do jeito que se pedir. */
function brokenProvider(kind: AiFailureKind, textBefore = ''): AiProvider {
  return {
    id: 'regras',
    isRemote: false,
    name: 'partido',
    isConfigured: () => true,
    async *stream(): AsyncIterable<string> {
      if (textBefore.length > 0) yield textBefore;
      throw new AiFailure(kind);
    },
  };
}

/** Um provedor que só responde, para o caso de controlo. */
function workingProvider(text: string): AiProvider {
  return {
    id: 'regras',
    isRemote: false,
    name: 'a funcionar',
    isConfigured: () => true,
    async *stream(): AsyncIterable<string> {
      yield text;
    },
  };
}

const CONTEXT = {
  now: new Date('2026-08-05T10:00:00Z'),
  openWindows: [],
  unreadNotifications: 0,
  systemState: 'normal' as const,
  theme: 'classic' as const,
  userName: 'Anderson',
  weather: null,
  tasks: { total: 0, done: 0 },
};

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
  setContextSource(() => CONTEXT);
});

describe('as regras, em si', () => {
  it('cancelar não é falha: não se diz nada', () => {
    const plan = planFallback({
      failure: new AiFailure('rede'),
      isAborted: true,
      hasText: false,
      isLocal: false,
    });

    expect(plan.action).toBe('nada');
  });

  it('sem provedor remoto, não há para onde cair — diz-se o motivo', () => {
    const plan = planFallback({
      failure: new AiFailure('rede'),
      isAborted: false,
      hasText: false,
      isLocal: true,
    });

    expect(plan.action).toBe('erro');
    expect(plan.note).toContain('não consegui chegar lá');
  });

  it('com a resposta já começada, acrescenta-se uma nota em vez de a trocar', () => {
    const plan = planFallback({
      failure: new AiFailure('servidor'),
      isAborted: false,
      hasText: true,
      isLocal: false,
    });

    // Trocar meia resposta por outra, vinda de outro provedor, dava um texto
    // que muda de voz a meio da frase.
    expect(plan.action).toBe('nota');
    expect(plan.note).toContain('ficou a meio');
  });

  it('do zero, cai para o local', () => {
    const plan = planFallback({
      failure: new AiFailure('servidor'),
      isAborted: false,
      hasText: false,
      isLocal: false,
    });

    expect(plan.action).toBe('local');
  });

  it('**a queda nunca é silenciosa**, seja qual for o motivo', () => {
    const kinds: readonly AiFailureKind[] = [
      'chave',
      'saldo',
      'limite',
      'servidor',
      'rede',
      'demora',
      'vazio',
      'configuracao',
    ];

    for (const kind of kinds) {
      const plan = planFallback({
        failure: new AiFailure(kind),
        isAborted: false,
        hasText: false,
        isLocal: false,
      });

      expect(plan.action, kind).toBe('local');
      expect(plan.note.length, kind).toBeGreaterThan(0);
    }
  });

  it('quando há alguma coisa a fazer, a nota diz o quê', () => {
    const comArranjo: readonly AiFailureKind[] = ['chave', 'saldo', 'configuracao', 'limite'];

    for (const kind of comArranjo) {
      const plan = planFallback({
        failure: new AiFailure(kind),
        isAborted: false,
        hasText: false,
        isLocal: false,
      });

      // Uma nota que só diz "falhou" deixa a pessoa sem saber o que fazer a
      // seguir. Estas quatro têm arranjo, e a nota tem de o dizer.
      expect(plan.note.length, kind).toBeGreaterThan(40);
    }
  });
});

describe('o serviço cumpre-as', () => {
  it('sem falha nenhuma, responde e fica em repouso', async () => {
    const service = new AIService(workingProvider('tudo bem'));

    await service.send('olá');

    expect(selectMessages(useAssistantStore.getState()).at(-1)?.text).toBe('tudo bem');
    expect(useAssistantStore.getState().mode).toBe('idle');
  });

  it('com o remoto em baixo, a resposta vem do local — e diz que veio', async () => {
    const service = new AIService(brokenProvider('servidor'));

    const answer = await service.send('que horas são');

    expect(answer).toContain('O modelo remoto não respondeu');
    expect(answer).toContain('do lado deles');

    // E depois da nota vem uma resposta a sério, do provedor local — a
    // asserção é sobre o que vem **a seguir** à nota, e não sobre um
    // comprimento à sorte que muda com a redação.
    const [, local = ''] = answer.split('Respondo com o que sei daqui:');
    expect(local.trim().length).toBeGreaterThan(0);
    expect(useAssistantStore.getState().mode).toBe('error');
  });

  it('a chave recusada leva a pessoa ao sítio onde a arranja', async () => {
    const service = new AIService(brokenProvider('chave'));

    const answer = await service.send('olá');

    expect(answer).toContain('a chave não foi aceite');
    expect(answer).toContain('Personalização');
  });

  it('uma resposta que se perde a meio mantém o que já tinha chegado', async () => {
    const service = new AIService(brokenProvider('rede', 'Estava a dizer que'));

    const answer = await service.send('conta-me uma coisa');

    expect(answer).toContain('Estava a dizer que');
    expect(answer).toContain('ficou a meio');
    // Não entrou uma segunda resposta por cima da primeira.
    expect(answer).not.toContain('Respondo com o que sei daqui');
  });

  it('a mensagem fica fechada, e não a piscar o cursor para sempre', async () => {
    const service = new AIService(brokenProvider('rede'));

    await service.send('olá');

    const last = selectMessages(useAssistantStore.getState()).at(-1);
    expect(last?.isStreaming).toBe(false);
  });

  it('cancelar não deixa nota nenhuma de erro', async () => {
    const service = new AIService(brokenProvider('rede'));

    const promise = service.send('olá');
    service.cancel();
    const answer = await promise;

    expect(answer).not.toContain('O modelo remoto');
    expect(useAssistantStore.getState().mode).toBe('idle');
  });
});
