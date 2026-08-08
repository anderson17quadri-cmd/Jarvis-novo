import { beforeEach, describe, expect, it } from 'vitest';

import { AIService } from '@/services/ai-service';
import { setContextSource } from '@/services/assistant/context';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { AiFailure, type AiFailureKind } from '@/types/ai-failure';
import type { AiProvider } from '@/types/assistant';

/**
 * A cadeia dentro do `AIService` (Parte 12 §Orquestrador multi-provedor).
 *
 * Aqui prova-se o pedido a sério: quando o provedor ativo fica sem saldo (ou
 * qualquer outra falha), o serviço tenta o próximo da cadeia sozinho, avisa
 * sempre, e só cai no `RuleProvider` quando a cadeia se esgota.
 */

function brokenProvider(name: string, kind: AiFailureKind): AiProvider {
  return {
    id: name,
    name,
    isConfigured: () => true,
    async *stream(): AsyncIterable<string> {
      throw new AiFailure(kind);
      yield '';
    },
  };
}

function workingProvider(name: string, text: string): AiProvider {
  return {
    id: name,
    name,
    isConfigured: () => true,
    async *stream(): AsyncIterable<string> {
      yield text;
    },
  };
}

const CONTEXT = {
  now: new Date('2026-08-08T10:00:00Z'),
  openWindows: [],
  unreadNotifications: 0,
  systemState: 'normal' as const,
  theme: 'classic' as const,
  userName: 'Anderson',
  weather: null,
};

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
  useNotificationStore.setState({ notifications: [], isPanelOpen: false });
  setContextSource(() => CONTEXT);
});

describe('cadeia de provedores', () => {
  it('quando o primeiro falha, o segundo responde sozinho — sem pedir nada a ninguém', async () => {
    const service = new AIService();
    service.setChain([
      { provider: brokenProvider('DeepSeek', 'saldo'), name: 'DeepSeek' },
      { provider: workingProvider('Claude', 'Olá, sou o Claude.'), name: 'Claude' },
    ]);

    const answer = await service.send('olá');

    expect(answer).toContain('Olá, sou o Claude.');
    expect(useAssistantStore.getState().mode).toBe('idle');
  });

  it('avisa sempre, nomeando quem falhou e para quem passou', async () => {
    const service = new AIService();
    service.setChain([
      { provider: brokenProvider('DeepSeek', 'saldo'), name: 'DeepSeek' },
      { provider: workingProvider('Claude', 'tudo bem'), name: 'Claude' },
    ]);

    await service.send('olá');

    const [notification] = useNotificationStore.getState().notifications;
    expect(notification?.description).toContain('DeepSeek');
    expect(notification?.description).toContain('Claude');
    expect(notification?.description).toContain('a conta não tem saldo');
  });

  it('salta por cima de mais do que uma falha até encontrar quem responda', async () => {
    const service = new AIService();
    service.setChain([
      { provider: brokenProvider('DeepSeek', 'saldo'), name: 'DeepSeek' },
      { provider: brokenProvider('Claude', 'chave'), name: 'Claude' },
      { provider: workingProvider('Ollama', 'aqui é o Ollama'), name: 'Ollama' },
    ]);

    const answer = await service.send('olá');

    expect(answer).toContain('aqui é o Ollama');

    // Duas trocas, uma por cada falha na cadeia.
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
  });

  it('esgotada a cadeia toda, cai no provedor local — como sempre aconteceu', async () => {
    const service = new AIService();
    service.setChain([
      { provider: brokenProvider('DeepSeek', 'saldo'), name: 'DeepSeek' },
      { provider: brokenProvider('Claude', 'chave'), name: 'Claude' },
    ]);

    const answer = await service.send('que horas são');

    expect(answer).toContain('Respondo com o que sei daqui');
    expect(useAssistantStore.getState().mode).toBe('error');
  });

  it('sem cadeia nenhuma (setProvider), o comportamento é exatamente o de sempre', async () => {
    const service = new AIService();
    service.setProvider(brokenProvider('DeepSeek', 'rede'));

    const answer = await service.send('olá');

    expect(answer).toContain('O modelo remoto não respondeu');
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('cancelar a meio de uma cadeia não gera aviso nenhum', async () => {
    const service = new AIService();
    service.setChain([
      { provider: brokenProvider('DeepSeek', 'rede'), name: 'DeepSeek' },
      { provider: workingProvider('Claude', 'tarde demais'), name: 'Claude' },
    ]);

    const promise = service.send('olá');
    service.cancel();
    await promise;

    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});
