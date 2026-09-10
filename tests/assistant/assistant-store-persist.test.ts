import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AssistantConversation } from '@/types/assistant';

/**
 * Consistência da persistência no `use-assistant-store` (revisão a sério,
 * 14/08/2026).
 *
 * Três mutadores mexiam em estado que é gravado — as mensagens (`removeMessage`,
 * `rewindToPrompt`) ou a conversa ativa (`selectConversation`) — sem chamar
 * `persist()`, ao contrário de todos os outros. Resultado observável: o lixo
 * que o `removeMessage` existe para tirar (uma linha em branco) reaparecia ao
 * reiniciar, e a app reabria na última conversa persistida em vez da escolhida.
 */

type Payload = { conversations: readonly AssistantConversation[]; activeId: string };

/** Extrai o último payload gravado e confirma que foi mesmo para as conversas. */
function lastPayload(set: MockInstance): Payload {
  const call = set.mock.calls.at(-1);
  expect(call).toBeDefined();
  const [key, value] = call as [string, Payload];
  expect(key).toBe(STORAGE_KEYS.conversations);
  return value;
}

function texts(payload: Payload): string[] {
  return payload.conversations.flatMap((entry) => entry.messages.map((message) => message.text));
}

beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
});

describe('mutadores de estado persistido também gravam', () => {
  it('removeMessage grava a remoção, para não voltar ao reiniciar', () => {
    const set = vi.spyOn(storageService, 'set');

    const store = useAssistantStore.getState();
    const id = store.addMessage('assistant', '');
    store.finishMessage(id);
    set.mockClear();

    store.removeMessage(id);

    expect(set).toHaveBeenCalledTimes(1);
    expect(texts(lastPayload(set))).toEqual([]);
  });

  it('rewindToPrompt grava o corte, mantendo o que veio antes', () => {
    const set = vi.spyOn(storageService, 'set');

    const store = useAssistantStore.getState();
    store.addMessage('assistant', 'Bom dia.');
    store.addMessage('user', 'que horas são');
    const answer = store.addMessage('assistant', 'São 14:30.');
    set.mockClear();

    store.rewindToPrompt(answer);

    expect(set).toHaveBeenCalledTimes(1);
    expect(texts(lastPayload(set))).toEqual(['Bom dia.']);
  });

  it('selectConversation grava a conversa escolhida', () => {
    const set = vi.spyOn(storageService, 'set');

    const store = useAssistantStore.getState();
    store.addMessage('user', 'primeira');
    const first = useAssistantStore.getState().activeId;
    store.startConversation();
    store.addMessage('user', 'segunda');
    set.mockClear();

    store.selectConversation(first);

    expect(set).toHaveBeenCalledTimes(1);
    expect(lastPayload(set).activeId).toBe(first);
  });
});
