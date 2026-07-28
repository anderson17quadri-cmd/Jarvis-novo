import { selectMessages, useAssistantStore } from '@/stores/use-assistant-store';
import type { AiProvider } from '@/types/assistant';
import { RuleProvider } from './ai-providers/rule-provider';
import { readContext } from './assistant/context';
import { memoryService } from './assistant/memory-service';
import { logService } from './log-service';

/**
 * Assistente.
 *
 * Recebe um pedido, põe o núcleo a "analisar", depois a "responder", e escreve
 * a resposta à medida que chega. Quem chama não sabe qual é o provedor.
 *
 * Trocar de provedor é `aiService.setProvider(new OpenAiProvider(chave))` —
 * nenhum componente muda, porque nenhum componente conhece o provedor.
 *
 * O contexto (Parte 7.2) chega por uma fonte registada de fora, e a memória
 * pelo `memoryService`. O serviço não conhece nenhuma store além da do
 * assistente, que é a que escreve.
 */
export class AIService {
  private controller: AbortController | null = null;

  constructor(private provider: AiProvider = new RuleProvider()) {}

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

    // A memória observa antes de responder: uma preferência dita agora tem de
    // estar guardada quando o provedor a for confirmar.
    memoryService.observe(prompt);

    store.addMessage('user', prompt);
    store.setMode('thinking');

    const messageId = store.addMessage('assistant', '', true);
    let full = '';
    let hasStartedSpeaking = false;

    try {
      for await (const chunk of this.provider.stream({
        prompt,
        history: selectMessages(useAssistantStore.getState()),
        context: readContext(),
        memory: memoryService.current,
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
      logService.log(
        'erro',
        'assistente',
        'O provedor falhou',
        error instanceof Error ? error.message : String(error),
      );
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

  /**
   * Repete o pedido que deu origem a uma resposta (Parte 7.1 §Regenerar).
   *
   * Apaga a resposta e o pedido, e volta a enviá-lo — o histórico fica com uma
   * troca só, não com duas versões da mesma pergunta.
   */
  async regenerate(messageId: string): Promise<string> {
    const prompt = useAssistantStore.getState().rewindToPrompt(messageId);
    if (prompt === null) return '';

    return this.send(prompt);
  }
}

export const aiService = new AIService();
