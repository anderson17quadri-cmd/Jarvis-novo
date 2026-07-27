import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AiProvider } from '@/types/assistant';
import { MockProvider } from './ai-providers/ai-provider';

/**
 * Assistente.
 *
 * Recebe um pedido, põe o núcleo a "analisar", depois a "responder", e escreve
 * a resposta à medida que chega. Quem chama não sabe qual é o provedor.
 *
 * Trocar de provedor é `aiService.setProvider(new OpenAiProvider(chave))` —
 * nenhum componente muda, porque nenhum componente conhece o provedor.
 */
export class AIService {
  private controller: AbortController | null = null;

  constructor(private provider: AiProvider = new MockProvider()) {}

  get providerName(): string {
    return this.provider.name;
  }

  setProvider(provider: AiProvider): void {
    this.cancel();
    this.provider = provider;
  }

  /** Cancela o pedido em curso, se houver. */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  /**
   * Envia uma mensagem e escreve a resposta no store.
   * Devolve o texto completo, para quem quiser lê-lo em voz alta.
   */
  async send(prompt: string): Promise<string> {
    const store = useAssistantStore.getState();

    // Um pedido novo cancela o anterior — não se acumulam respostas a escrever.
    this.cancel();
    this.controller = new AbortController();
    const { signal } = this.controller;

    store.addMessage('user', prompt);
    store.setMode('thinking');

    const messageId = store.addMessage('assistant', '', true);
    let full = '';
    let hasStartedSpeaking = false;

    try {
      for await (const chunk of this.provider.stream({
        prompt,
        history: useAssistantStore.getState().messages,
        signal,
      })) {
        if (signal.aborted) break;

        // O primeiro pedaço é o momento em que passa de "analisar" a "responder".
        if (!hasStartedSpeaking) {
          hasStartedSpeaking = true;
          store.setMode('speaking');
        }

        full += chunk;
        useAssistantStore.getState().appendToMessage(messageId, chunk);
      }
    } catch (error) {
      console.warn('[ai] o provedor falhou:', error);
      useAssistantStore.getState().setMode('error');
      useAssistantStore.getState().appendToMessage(
        messageId,
        'Não consegui completar o pedido. Tente novamente.',
      );
      useAssistantStore.getState().finishMessage(messageId);
      return full;
    }

    useAssistantStore.getState().finishMessage(messageId);
    useAssistantStore.getState().setMode('idle');
    this.controller = null;

    return full;
  }
}

export const aiService = new AIService();
