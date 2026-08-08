import { describe, expect, it } from 'vitest';

import { AiFailure } from '@/types/ai-failure';
import {
  configuredChain,
  firstInChain,
  nextStep,
  type ChainMember,
} from '@/services/ai-providers/provider-chain';
import type { AiProvider } from '@/types/assistant';

/** Um provedor de mentira, só para a cadeia decidir com base nele. */
function fakeProvider(id: string, configured: boolean): AiProvider {
  return {
    id,
    name: id,
    isConfigured: () => configured,
    stream: async function* (): AsyncIterable<string> {
      throw new Error('não usado nestes testes');
      yield '';
    },
  };
}

function member(name: string, configured: boolean): ChainMember {
  return { provider: fakeProvider(name, configured), name };
}

describe('configuredChain e firstInChain', () => {
  it('tira os provedores sem chave da lista', () => {
    const chain = [member('DeepSeek', true), member('Claude', false), member('Ollama', true)];

    expect(configuredChain(chain).map((m) => m.name)).toEqual(['DeepSeek', 'Ollama']);
  });

  it('o primeiro configurado é o que começa a responder', () => {
    const chain = [member('DeepSeek', false), member('Claude', true), member('Ollama', true)];

    expect(firstInChain(chain)?.name).toBe('Claude');
  });

  it('nenhum configurado devolve null', () => {
    const chain = [member('DeepSeek', false), member('Claude', false)];

    expect(firstInChain(chain)).toBeNull();
  });
});

describe('nextStep', () => {
  it('salta para o próximo configurado, com um aviso que nomeia os dois', () => {
    const chain = [member('DeepSeek', true), member('Claude', true), member('Ollama', true)];

    const step = nextStep(chain, 'DeepSeek', new AiFailure('saldo'), false);

    expect(step.action).toBe('tentar');
    expect(step.member?.name).toBe('Claude');
    expect(step.notice).toContain('DeepSeek');
    expect(step.notice).toContain('Claude');
    expect(step.notice).toContain('a conta não tem saldo');
  });

  it('passa por cima de um provedor sem chave, sem parar nele', () => {
    const chain = [member('DeepSeek', true), member('Claude', false), member('Ollama', true)];

    const step = nextStep(chain, 'DeepSeek', new AiFailure('limite'), false);

    expect(step.member?.name).toBe('Ollama');
  });

  it('esgota a cadeia quando não há mais nenhum a seguir', () => {
    const chain = [member('DeepSeek', true), member('Claude', true)];

    const step = nextStep(chain, 'Claude', new AiFailure('servidor'), false);

    expect(step.action).toBe('esgotado');
    expect(step.notice).toContain('Não há mais nenhum provedor configurado');
  });

  it('um cancelamento não gera aviso nenhum', () => {
    const chain = [member('DeepSeek', true), member('Claude', true)];

    const step = nextStep(chain, 'DeepSeek', new AiFailure('rede'), true);

    expect(step.action).toBe('esgotado');
    expect(step.notice).toBe('');
  });
});
