import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AssistantWindow from '@/apps/assistant/AssistantWindow';
import { aiService } from '@/services/ai-service';
import { memoryService } from '@/services/assistant/memory-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AiProvider } from '@/types/assistant';

/**
 * A resposta da janela normal do assistente fala (item 18, reportado ao vivo).
 *
 * A janela responde pelo `sendWithTools`, que nunca falava — só o caminho dos
 * comandos por voz (`ask`, item 16) tinha `speakQueued` ligado. Prova-se aqui
 * que escrever e enviar na janela normal agora fala a resposta frase a frase,
 * com o mesmo mecanismo (`extractSentences` + `speakQueued`).
 */

const { speakQueued, limparFilaDeFala } = vi.hoisted(() => ({
  speakQueued: vi.fn(),
  limparFilaDeFala: vi.fn(),
}));

vi.mock('@/hooks/use-voice', () => ({
  useVoice: () => ({
    isSupported: false,
    toggleListening: vi.fn(),
    speak: vi.fn(),
    speakQueued,
    limparFilaDeFala,
    isConversationMode: false,
    toggleConversationMode: vi.fn(),
  }),
}));

/** Um provedor que responde em dois bocados, para a frase fechar a meio. */
const provedorFalante: AiProvider = {
  id: 'fake',
  name: 'Fake',
  isRemote: false,
  isConfigured: () => true,
  async *stream() {
    yield 'Olá. ';
    yield 'Tudo bem.';
  },
};

beforeEach(() => {
  localStorage.clear();
  memoryService.clear();
  useAssistantStore.getState().reset();
  speakQueued.mockClear();
  limparFilaDeFala.mockClear();
  aiService.setProvider(provedorFalante);
});

describe('a resposta da janela normal fala (item 18)', () => {
  it('escrever e enviar fala a resposta frase a frase', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    await user.type(screen.getByLabelText('Comando para o assistente'), 'olá{Enter}');

    await waitFor(() => {
      expect(speakQueued).toHaveBeenCalledWith(expect.stringContaining('Olá.'));
      expect(speakQueued).toHaveBeenCalledWith(expect.stringContaining('Tudo bem.'));
    });
  });

  it('limpa a fila de fala antes de uma resposta nova, como o caminho por voz', async () => {
    const user = userEvent.setup();
    render(<AssistantWindow />);

    await user.type(screen.getByLabelText('Comando para o assistente'), 'olá{Enter}');

    await waitFor(() => expect(limparFilaDeFala).toHaveBeenCalled());
  });
});
