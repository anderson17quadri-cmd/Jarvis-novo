import { beforeEach, describe, expect, it } from 'vitest';

import { selectMessages, titleFrom, useAssistantStore } from '@/stores/use-assistant-store';
import { CONVERSATION_LIMIT, TITLE_MAX_LENGTH, UNTITLED_CONVERSATION } from '@/types/assistant';

/** Devolve a store a um estado de arranque, sem nada gravado. */
beforeEach(() => {
  localStorage.clear();
  useAssistantStore.getState().reset();
});

describe('título', () => {
  it('sem texto nenhum fica com o nome de sempre', () => {
    expect(titleFrom('   ')).toBe(UNTITLED_CONVERSATION);
  });

  it('um pedido curto é o título tal e qual', () => {
    expect(titleFrom('Abre os emails')).toBe('Abre os emails');
  });

  it('um pedido longo corta numa palavra inteira', () => {
    const long = 'Mostra-me todas as notificações por ler e depois abre a janela de tarefas';
    const title = titleFrom(long);

    expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH + 1);
    expect(title.endsWith('…')).toBe(true);

    // O que ficou é um começo do texto seguido de um espaço: se tivesse cortado
    // a meio de uma palavra, o carácter seguinte seria uma letra.
    const kept = title.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long[kept.length]).toBe(' ');
  });

  it('a conversa ganha o título do primeiro pedido, não da saudação', () => {
    const store = useAssistantStore.getState();
    store.addMessage('assistant', 'Bom dia.');
    expect(current().title).toBe(UNTITLED_CONVERSATION);

    store.addMessage('user', 'Abre os emails');
    expect(current().title).toBe('Abre os emails');
  });

  it('o segundo pedido não renomeia a conversa', () => {
    const store = useAssistantStore.getState();
    store.addMessage('user', 'Abre os emails');
    store.addMessage('user', 'E agora as tarefas');

    expect(current().title).toBe('Abre os emails');
  });
});

describe('conversas', () => {
  it('começa com uma, vazia e ativa', () => {
    expect(useAssistantStore.getState().conversations).toHaveLength(1);
    expect(selectMessages(useAssistantStore.getState())).toHaveLength(0);
  });

  it('uma nova conversa fica ativa e a antiga guardada', () => {
    useAssistantStore.getState().addMessage('user', 'primeira');
    const before = useAssistantStore.getState().activeId;

    const id = useAssistantStore.getState().startConversation();

    expect(useAssistantStore.getState().activeId).toBe(id);
    expect(useAssistantStore.getState().conversations).toHaveLength(2);
    expect(
      useAssistantStore.getState().conversations.find((entry) => entry.id === before)?.messages,
    ).toHaveLength(1);
  });

  it('pedir duas conversas novas seguidas não deixa vazias pelo caminho', () => {
    useAssistantStore.getState().startConversation();
    useAssistantStore.getState().startConversation();

    expect(useAssistantStore.getState().conversations).toHaveLength(1);
  });

  it('escrever numa só mexe nessa', () => {
    useAssistantStore.getState().addMessage('user', 'primeira');
    const first = useAssistantStore.getState().activeId;

    useAssistantStore.getState().startConversation();
    useAssistantStore.getState().addMessage('user', 'segunda');

    const kept = useAssistantStore.getState().conversations.find((entry) => entry.id === first);
    expect(kept?.messages[0]?.text).toBe('primeira');
    expect(selectMessages(useAssistantStore.getState())[0]?.text).toBe('segunda');
  });

  it('fixar põe a conversa à frente da mais recente', () => {
    useAssistantStore.getState().addMessage('user', 'antiga');
    const old = useAssistantStore.getState().activeId;

    useAssistantStore.getState().startConversation();
    useAssistantStore.getState().addMessage('user', 'nova');
    useAssistantStore.getState().togglePinned(old);

    const [first] = [...useAssistantStore.getState().conversations].sort((a, b) =>
      a.isPinned === b.isPinned ? b.updatedAt - a.updatedAt : a.isPinned ? -1 : 1,
    );
    expect(first?.id).toBe(old);
  });

  it('apagar a conversa ativa deixa outra aberta, nunca o vazio', () => {
    useAssistantStore.getState().addMessage('user', 'única');
    useAssistantStore.getState().removeConversation(useAssistantStore.getState().activeId);

    expect(useAssistantStore.getState().conversations).toHaveLength(1);
    expect(selectMessages(useAssistantStore.getState())).toHaveLength(0);
  });

  it('escolher uma conversa que não existe não muda nada', () => {
    const before = useAssistantStore.getState().activeId;
    useAssistantStore.getState().selectConversation('não-existe');

    expect(useAssistantStore.getState().activeId).toBe(before);
  });

  it('o histórico não cresce sem limite, mas as fixadas não caem', () => {
    useAssistantStore.getState().addMessage('user', 'a guardar');
    const pinned = useAssistantStore.getState().activeId;
    useAssistantStore.getState().togglePinned(pinned);

    for (let index = 0; index < CONVERSATION_LIMIT + 5; index += 1) {
      useAssistantStore.getState().startConversation();
      useAssistantStore.getState().addMessage('user', `conversa ${index}`);
    }

    const { conversations } = useAssistantStore.getState();
    expect(conversations.some((entry) => entry.id === pinned)).toBe(true);
    expect(conversations.filter((entry) => !entry.isPinned).length).toBeLessThanOrEqual(
      CONVERSATION_LIMIT + 1,
    );
  });
});

describe('mensagens', () => {
  it('marcar como favorita e desmarcar', () => {
    const id = useAssistantStore.getState().addMessage('assistant', 'resposta');

    useAssistantStore.getState().toggleFavourite(id);
    expect(selectMessages(useAssistantStore.getState())[0]?.isFavourite).toBe(true);

    useAssistantStore.getState().toggleFavourite(id);
    expect(selectMessages(useAssistantStore.getState())[0]?.isFavourite).toBe(false);
  });

  it('regenerar apaga a resposta e o pedido, e devolve o pedido', () => {
    const store = useAssistantStore.getState();
    store.addMessage('user', 'que horas são');
    const answer = store.addMessage('assistant', 'São 14:30.');

    const prompt = useAssistantStore.getState().rewindToPrompt(answer);

    expect(prompt).toBe('que horas são');
    expect(selectMessages(useAssistantStore.getState())).toHaveLength(0);
  });

  it('regenerar mantém o que veio antes da troca', () => {
    const store = useAssistantStore.getState();
    store.addMessage('assistant', 'Bom dia.');
    store.addMessage('user', 'que horas são');
    const answer = store.addMessage('assistant', 'São 14:30.');

    useAssistantStore.getState().rewindToPrompt(answer);

    const messages = selectMessages(useAssistantStore.getState());
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe('Bom dia.');
  });

  it('uma resposta sem pedido antes não se regenera', () => {
    const answer = useAssistantStore.getState().addMessage('assistant', 'Bom dia.');

    expect(useAssistantStore.getState().rewindToPrompt(answer)).toBeNull();
    expect(selectMessages(useAssistantStore.getState())).toHaveLength(1);
  });

  it('escrever letra a letra vai parar à conversa ativa', () => {
    const id = useAssistantStore.getState().addMessage('assistant', '', true);

    useAssistantStore.getState().appendToMessage(id, 'Ol');
    useAssistantStore.getState().appendToMessage(id, 'á');
    useAssistantStore.getState().finishMessage(id);

    const [message] = selectMessages(useAssistantStore.getState());
    expect(message?.text).toBe('Olá');
    expect(message?.isStreaming).toBe(false);
  });
});

describe('persistência', () => {
  it('as conversas sobrevivem a recarregar', async () => {
    useAssistantStore.getState().addMessage('user', 'lembra-te disto');
    await useAssistantStore.getState().persist();

    // Esvaziar só a memória, sem gravar: `reset` apagaria também o que está
    // guardado, e o teste deixava de ser sobre recarregar.
    useAssistantStore.setState({ conversations: [], activeId: '' });
    await useAssistantStore.getState().hydrate();

    expect(
      useAssistantStore
        .getState()
        .conversations.some((entry) => entry.messages.some((m) => m.text === 'lembra-te disto')),
    ).toBe(true);
  });

  it('uma resposta a meio não fica a piscar o cursor para sempre', async () => {
    useAssistantStore.getState().addMessage('assistant', 'a escrever', true);
    await useAssistantStore.getState().persist();

    useAssistantStore.setState({ conversations: [], activeId: '' });
    await useAssistantStore.getState().hydrate();

    const streaming = useAssistantStore
      .getState()
      .conversations.flatMap((entry) => entry.messages)
      .filter((message) => message.isStreaming);

    expect(streaming).toHaveLength(0);
  });

  it('sem nada gravado, mantém a conversa vazia em vez de ficar sem nenhuma', async () => {
    await useAssistantStore.getState().hydrate();

    expect(useAssistantStore.getState().conversations).toHaveLength(1);
  });
});

function current() {
  const state = useAssistantStore.getState();
  const conversation = state.conversations.find((entry) => entry.id === state.activeId);
  if (!conversation) throw new Error('sem conversa ativa');
  return conversation;
}
