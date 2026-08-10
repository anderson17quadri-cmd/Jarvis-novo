import { beforeEach, describe, expect, it } from 'vitest';

import { AIService } from '@/services/ai-service';
import { setContextSource } from '@/services/assistant/context';
import { logService } from '@/services/log-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { usePluginStore } from '@/stores/use-plugin-store';
import type { AiProvider } from '@/types/assistant';

/**
 * Permissões por plugin, a sério (Parte 14 §Permissões por plugin).
 *
 * Nenhum plugin executa código próprio, mas a permissão de rede de
 * "Assistente JARVIS" (`core-assistant`) condiciona uma chamada real: se
 * recusada, nenhum pedido sai para um provedor remoto — nem à primeira,
 * nem na cadeia. A prova aqui não é só "a resposta veio do local", é que o
 * provedor remoto **nunca chega a ser chamado**.
 */

const CONTEXT = {
  now: new Date('2026-08-10T10:00:00Z'),
  openWindows: [],
  unreadNotifications: 0,
  systemState: 'normal' as const,
  theme: 'classic' as const,
  userName: 'Anderson',
  weather: null,
  tasks: { total: 0, done: 0 },
};

/** Um provedor remoto que rebenta o teste se alguém lhe chamar `stream`. */
function remoteProviderThatMustNotBeCalled(name: string): AiProvider {
  return {
    id: name,
    name,
    isRemote: true,
    isConfigured: () => true,
    async *stream(): AsyncIterable<string> {
      throw new Error(`${name}.stream() foi chamado com a rede recusada — não devia.`);
      yield '';
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
  useNotificationStore.setState({ notifications: [] });
  usePluginStore.setState({ deniedPermissions: {} });
  setContextSource(() => CONTEXT);
});

describe('recusar a rede ao assistente impede pedidos a sério', () => {
  it('send(): o provedor remoto nunca é chamado, e a resposta vem do local', async () => {
    usePluginStore.getState().setPermission('core-assistant', 'network', false);
    const service = new AIService(remoteProviderThatMustNotBeCalled('DeepSeek'));

    const answer = await service.send('que horas são');

    expect(answer).toContain('a permissão de rede do assistente está recusada');
    expect(answer).toContain('Privacidade');
  });

  it('um provedor local (isRemote: false) nunca é bloqueado — só o remoto', async () => {
    usePluginStore.getState().setPermission('core-assistant', 'network', false);
    const local: AiProvider = {
      id: 'regras',
      name: 'local',
      isRemote: false,
      isConfigured: () => true,
      async *stream(): AsyncIterable<string> {
        yield 'respondo do próprio dispositivo';
      },
    };
    const service = new AIService(local);

    const answer = await service.send('olá');

    expect(answer).toBe('respondo do próprio dispositivo');
  });

  it('permitir de volta deixa o provedor remoto voltar a responder', async () => {
    const provider: AiProvider = {
      id: 'deepseek',
      name: 'DeepSeek',
      isRemote: true,
      isConfigured: () => true,
      async *stream(): AsyncIterable<string> {
        yield 'resposta real';
      },
    };
    const service = new AIService(provider);

    usePluginStore.getState().setPermission('core-assistant', 'network', false);
    expect(await service.send('olá')).not.toBe('resposta real');

    usePluginStore.getState().setPermission('core-assistant', 'network', true);
    expect(await service.send('olá')).toBe('resposta real');
  });

  it('cadeia: nenhum dos dois remotos é chamado, e não há aviso de "trocado"', async () => {
    usePluginStore.getState().setPermission('core-assistant', 'network', false);
    const service = new AIService(remoteProviderThatMustNotBeCalled('DeepSeek'));
    service.setChain([
      { provider: remoteProviderThatMustNotBeCalled('DeepSeek'), name: 'DeepSeek' },
      { provider: remoteProviderThatMustNotBeCalled('Claude'), name: 'Claude' },
    ]);

    const answer = await service.send('olá');

    expect(answer).toContain('permissão de rede');
    // Nenhuma notificação de troca — porque não houve troca nenhuma a sério.
    const avisosDeTroca = useNotificationStore
      .getState()
      .notifications.filter((n) => n.title === 'Provedor de IA trocado');
    expect(avisosDeTroca).toHaveLength(0);
  });

  it('a auditoria regista a recusa, para não ficar invisível', () => {
    logService.clear();
    usePluginStore.getState().setPermission('core-assistant', 'network', false);

    const entrada = logService.list.find((entry) => entry.message.includes('core-assistant'));
    expect(entrada?.message).toContain('Permissão "network"');
    expect(entrada?.message).toContain('recusado');
  });
});
