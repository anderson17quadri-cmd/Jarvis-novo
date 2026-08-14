import { selectMessages, useAssistantStore } from '@/stores/use-assistant-store';
import { selectPermissionDenied, usePluginStore } from '@/stores/use-plugin-store';
import { notificationService } from './notification-service';
import type { AiProvider, AiRequest } from '@/types/assistant';
import { buildMessages, DeepSeekProvider } from './ai-providers/deepseek-provider';
import { ClaudeProvider } from './ai-providers/claude-provider';
import { describeChoice } from './ai-providers/model-choice';
import { OllamaProvider } from './ai-providers/ollama-provider';
import { nextStep, type ChainMember } from './ai-providers/provider-chain';
import { RuleProvider } from './ai-providers/rule-provider';
import { runTool, type ToolCall } from './assistant/tool-runner';
import { readContext } from './assistant/context';
import { resolveReferences } from './assistant/reference-resolver';
import { memoryService } from './assistant/memory-service';
import { logService } from './log-service';
import { AiFailure, planFallback } from '@/types/ai-failure';

/**
 * Assistente.
 *
 * Recebe um pedido, põe o núcleo a "analisar", depois a "responder", e escreve
 * a resposta à medida que chega. Quem chama não sabe qual é o provedor.
 *
 * Trocar de provedor é `aiService.setProvider(new OpenAiProvider(chave))` —
 * nenhum componente muda, porque nenhum componente conhece o provedor.
 *
 * **A cadeia (Parte 12 §Orquestrador multi-provedor).** `setChain` liga mais
 * do que um provedor de uma vez: o primeiro é o ativo, e se ele falhar por
 * chave, saldo, limite ou rede, o `recover` tenta o seguinte sozinho, avisa
 * sempre, e só cai no `RuleProvider` quando a cadeia toda se esgota. Quem
 * escolheu só um provedor (`setProvider`) continua a funcionar exatamente
 * como antes — a cadeia fica vazia, e falhar cai direto no local.
 *
 * O contexto (Parte 7.2) chega por uma fonte registada de fora, e a memória
 * pelo `memoryService`. O serviço não conhece nenhuma store além da do
 * assistente, que é a que escreve.
 */
/** Quantas idas ao modelo se permitem antes de se parar. */
const TOOL_ROUNDS = 5;

/**
 * O plugin que o catálogo usa para descrever o assistente (Parte 14
 * §Permissões por plugin) — não executa código próprio, como nenhum
 * plugin executa, mas a permissão de rede dele é a sério: ver
 * `AIService.networkBlocked`.
 */
const ASSISTANT_PLUGIN_ID = 'core-assistant';

/** Uma ferramenta destrutiva à espera de resposta. */
export interface PendingConfirmation {
  readonly call: ToolCall;
  readonly question: string;
}

export class AIService {
  private controller: AbortController | null = null;
  private chain: readonly ChainMember[] = [];

  constructor(private provider: AiProvider = new RuleProvider()) {}

  get providerName(): string {
    return this.provider.name;
  }

  setProvider(provider: AiProvider): void {
    this.cancel();
    this.provider = provider;
    this.chain = [];
  }

  /**
   * Liga uma cadeia de provedores. O primeiro configurado passa a ser o
   * ativo; os outros só entram em jogo se este falhar (ver `recover`).
   *
   * Uma cadeia vazia (nenhum provedor configurado) cai no `RuleProvider` —
   * o mesmo comportamento de sempre quando não há para onde responder.
   */
  setChain(chain: readonly ChainMember[]): void {
    this.cancel();
    this.chain = chain;
    this.provider = chain[0]?.provider ?? new RuleProvider();
  }

  /** Cancela o pedido em curso, se houver. */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  /**
   * `true` quando o provedor atual mandaria o pedido para fora da máquina e
   * a permissão de rede do plugin "Assistente JARVIS" está recusada (Parte
   * 14 §Permissões por plugin). O `RuleProvider` e o Ollama nunca batem
   * aqui — `isRemote` é `false` nos dois, porque nenhum sai da máquina.
   */
  private networkBlocked(): boolean {
    return (
      this.provider.isRemote &&
      selectPermissionDenied(usePluginStore.getState(), ASSISTANT_PLUGIN_ID, 'network')
    );
  }

  /**
   * Envia uma mensagem e escreve a resposta no store.
   * Devolve o texto completo, para quem quiser lê-lo em voz alta.
   *
   * `onChunk`, se dado, recebe cada pedaço à medida que chega — para quem
   * quiser reagir ao streaming em vez de esperar pelo texto completo (ex.:
   * falar por frase, item 16 reportado ao vivo pelo utilizador).
   */
  async send(prompt: string, onChunk?: (chunk: string) => void): Promise<string> {
    const store = useAssistantStore.getState();

    // Um pedido novo cancela o anterior — não se acumulam respostas a escrever.
    this.cancel();
    this.controller = new AbortController();
    const controller = this.controller;
    const { signal } = controller;

    // A memória observa antes de responder: uma preferência dita agora tem de
    // estar guardada quando o provedor a for confirmar.
    memoryService.observe(prompt);

    store.addMessage('user', prompt);
    store.setMode('thinking');

    // Resolve referências ambíguas ("esse ficheiro", "isso") contra o
    // histórico da conversa, usando o próprio provedor de IA — sem regras
    // escritas à mão. Se a resolução falhar ou não for precisa, o pedido
    // original segue na mesma.
    const history = selectMessages(useAssistantStore.getState());
    const resolvedPrompt = await resolveReferences(prompt, history, this.provider, signal);
    if (signal.aborted) {
      // Cancel a solo: ninguém tomou o lugar, repõe-se o modo. Se um pedido
      // novo cancelou este, o modo já é dele — não se toca.
      if (this.controller === null) useAssistantStore.getState().setMode('idle');
      return '';
    }

    const messageId = store.addMessage('assistant', '', true);
    let full = '';

    // A permissão bloqueia antes de qualquer pedido sair — não é uma falha
    // de rede a sério, é a rede nem chegar a ser tentada.
    if (this.networkBlocked()) {
      return await this.recover(new AiFailure('permissao'), {
        messageId,
        request: {
          prompt: resolvedPrompt,
          history: selectMessages(useAssistantStore.getState()),
          context: readContext(),
          memory: memoryService.current,
          signal,
        },
        text: '',
        isAborted: false,
        onChunk,
      });
    }
    let hasStartedSpeaking = false;

    try {
      for await (const chunk of this.provider.stream({
        prompt: resolvedPrompt,
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
        onChunk?.(chunk);
      }
    } catch (error) {
      return await this.recover(error, {
        messageId,
        request: {
          prompt: resolvedPrompt,
          history: selectMessages(useAssistantStore.getState()),
          context: readContext(),
          memory: memoryService.current,
          signal,
        },
        text: full,
        isAborted: signal.aborted,
        onChunk,
      });
    }

    this.noteModel(messageId);
    useAssistantStore.getState().finishMessage(messageId);

    // Um pedido novo já cancelou este e ficou com o modo e o controller —
    // repor aqui apagava o estado dele (e, pior, deixava-o impossível de
    // cancelar: item 15, revisão a sério). Um cancel a solo (controller a
    // `null`) ainda precisa de repor o modo a "idle".
    if (this.controller !== null && this.controller !== controller) {
      return full;
    }
    useAssistantStore.getState().setMode('idle');
    if (this.controller === controller) this.controller = null;

    return full;
  }

  /**
   * Ciclo com ferramentas (Parte 7.2 §Agentes).
   *
   * O modelo pede ferramentas, executam-se, e o resultado volta para ele
   * decidir o passo seguinte. Corre até ele parar de pedir, ou até ao limite —
   * um modelo que se engane pode pedir a mesma coisa em círculo, e sem tecto
   * ficava a gastar dinheiro para sempre.
   *
   * Devolve as confirmações pendentes, se houver: nada destrutivo corre sem
   * alguém dizer que sim, e quem pergunta é a interface.
   *
   * `onChunk`, se dado, recebe cada pedaço de texto do modelo à medida que
   * chega — o mesmo contrato de `send()`. É por aqui que a janela normal do
   * assistente fala frase a frase (item 18, reportado ao vivo): antes, este
   * caminho não expunha o streaming e a resposta saía sempre em silêncio.
   */
  async sendWithTools(
    prompt: string,
    onChunk?: (chunk: string) => void,
  ): Promise<readonly PendingConfirmation[]> {
    const provider = this.provider;

    // A DeepSeek e o Claude sabem sempre pedir ferramentas. A Ollama só
    // quando o modelo escolhido for de uma família conhecida por suportar
    // `tools` (ver `OllamaProvider.supportsToolCalling`) — um modelo sem essa
    // capacidade recebe um pedido sem ferramentas, exatamente como o
    // `RuleProvider`.
    if (!isToolCapable(provider)) {
      await this.send(prompt, onChunk);
      return [];
    }

    this.cancel();
    this.controller = new AbortController();
    const controller = this.controller;
    const { signal } = controller;

    memoryService.observe(prompt);
    const store = useAssistantStore.getState();
    store.addMessage('user', prompt);
    store.setMode('thinking');

    // Resolve referências também no caminho com ferramentas.
    const toolsHistory = selectMessages(useAssistantStore.getState());
    const toolsResolvedPrompt = await resolveReferences(prompt, toolsHistory, provider, signal);
    if (signal.aborted) {
      // Mesmo guarda do `send()`: cancel a solo repõe o modo; um pedido novo
      // já tomou conta dele.
      if (this.controller === null) useAssistantStore.getState().setMode('idle');
      return [];
    }

    const request: AiRequest = {
      prompt: toolsResolvedPrompt,
      history: selectMessages(useAssistantStore.getState()),
      context: readContext(),
      memory: memoryService.current,
      signal,
    };

    const messages: unknown[] = [...buildMessages(request)];
    const pending: PendingConfirmation[] = [];

    // A mesma verificação de `send()`, antes de qualquer pedido — só morde a
    // DeepSeek, já que `networkBlocked()` olha para `provider.isRemote`, e a
    // Ollama é sempre `false` (não sai da máquina).
    if (this.networkBlocked()) {
      const messageId = useAssistantStore.getState().addMessage('assistant', '', true);
      await this.recover(new AiFailure('permissao'), { messageId, request, text: '', isAborted: false, onChunk });
      if (this.controller === controller) this.controller = null;
      return pending;
    }

    for (let round = 0; round < TOOL_ROUNDS; round += 1) {
      const messageId = useAssistantStore.getState().addMessage('assistant', '', true);
      let hasStartedSpeaking = false;

      let text = '';
      let result;

      try {
        result = await provider.run(request, messages, (chunk) => {
          if (!hasStartedSpeaking) {
            hasStartedSpeaking = true;
            useAssistantStore.getState().setMode('speaking');
          }
          text += chunk;
          useAssistantStore.getState().appendToMessage(messageId, chunk);
          onChunk?.(chunk);
        });
      } catch (error) {
        /*
         * As mesmas regras do envio simples.
         *
         * `isLocal` é `false` de propósito: chegou-se aqui porque o provedor
         * sabe pedir ferramentas (a DeepSeek, ou a Ollama com um modelo capaz),
         * e o local existe para onde cair — só não sabe pedir ferramentas, o
         * que é exatamente a razão de o pedido passar a ser respondido sem elas.
         */
        await this.recover(error, { messageId, request, text, isAborted: signal.aborted, onChunk });
        if (this.controller === controller) this.controller = null;
        return pending;
      }

      this.noteModel(messageId);
      useAssistantStore.getState().finishMessage(messageId);

      if (signal.aborted) break;

      // Sem ferramentas pedidas, a resposta é a resposta.
      if (result.toolCalls.length === 0) {
        // Uma passagem que só serviu para pedir ferramentas deixa uma mensagem
        // vazia no histórico. Tira-se.
        if (result.text.trim().length === 0) {
          useAssistantStore.getState().removeMessage(messageId);
        }
        break;
      }

      if (result.text.trim().length === 0) {
        useAssistantStore.getState().removeMessage(messageId);
      }

      messages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: result.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      });

      for (const call of result.toolCalls) {
        const outcome = await runTool(call);

        if (outcome.status === 'confirmar') {
          pending.push({ call, question: outcome.message });
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content:
            outcome.status === 'confirmar'
              ? `À espera de confirmação: ${outcome.message}`
              : outcome.message,
        });
      }
    }

    // Mesmo guarda do `send()`: um pedido novo já cancelou este e ficou com o
    // modo e o controller — não se repõe nem se limpa por cima dele.
    if (this.controller !== null && this.controller !== controller) {
      return pending;
    }
    useAssistantStore.getState().setMode(pending.length > 0 ? 'idle' : 'success');
    if (this.controller === controller) this.controller = null;
    return pending;
  }

  /**
   * Deixa escrito que modelo respondeu (Parte 12 §Seleção automática).
   *
   * Só o provedor sabe o que acabou por usar, porque a escolha é por pedido.
   * O provedor local não declara nada — não tem modelo nenhum a declarar, e
   * inventar-lhe um rótulo era ruído.
   */
  private noteModel(messageId: string): void {
    if (!(this.provider instanceof DeepSeekProvider)) return;

    const choice = this.provider.choice;
    if (!choice) return;

    useAssistantStore.getState().noteModel(messageId, describeChoice(choice));
  }

  /**
   * O que se faz quando o provedor falha (Parte 12 §Regras de fallback).
   *
   * As regras estão no `planFallback`, que é uma função pura sobre a falha e o
   * estado da resposta — assim testam-se sem rede, sem stores e sem relógio.
   * Aqui só se cumpre o plano.
   *
   * O que **não** acontece nunca: cair para o provedor local sem o dizer. Uma
   * resposta mais fraca sem explicação faz a pessoa achar que o assistente
   * piorou, quando o que aconteceu foi a chave deixar de servir.
   */
  private async recover(
    error: unknown,
    state: {
      readonly messageId: string;
      readonly request: AiRequest;
      readonly text: string;
      readonly isAborted: boolean;
      readonly onChunk?: ((chunk: string) => void) | undefined;
    },
  ): Promise<string> {
    const store = (): ReturnType<typeof useAssistantStore.getState> =>
      useAssistantStore.getState();

    const failure = error instanceof AiFailure ? error : new AiFailure('rede');

    logService.log(
      'erro',
      'assistente',
      `O provedor falhou: ${failure.kind}`,
      error instanceof Error ? error.message : String(error),
    );

    // A cadeia tenta o próximo provedor configurado antes de cair no local —
    // é o que faz "sem saldo" virar "a passar para o Claude" em vez de "a
    // passar para o local" logo à primeira falha.
    if (this.chain.length > 0) {
      const step = nextStep(this.chain, this.provider.name, failure, state.isAborted);

      if (step.action === 'tentar' && step.member) {
        // O próximo da cadeia também é remoto e também está bloqueado: nem
        // se tenta, nem se avisa "trocado" para uma troca que nunca chega a
        // acontecer a sério. `this.provider` avança na mesma, para o
        // `nextStep` da recursão seguinte não voltar a propor este mesmo.
        if (
          step.member.provider.isRemote &&
          selectPermissionDenied(usePluginStore.getState(), ASSISTANT_PLUGIN_ID, 'network')
        ) {
          this.provider = step.member.provider;
          return await this.recover(new AiFailure('permissao'), state);
        }

        notificationService.warn('Provedor de IA trocado', step.notice, {
          category: 'assistente',
        });
        logService.audit(step.notice, 'executado');

        this.provider = step.member.provider;
        const notice = `\n\n— ${step.notice}\n\n`;
        store().appendToMessage(state.messageId, notice);
        state.onChunk?.(notice);

        let full = '';
        let hasStartedSpeaking = false;

        try {
          for await (const chunk of this.provider.stream(state.request)) {
            if (state.request.signal?.aborted) break;

            if (!hasStartedSpeaking) {
              hasStartedSpeaking = true;
              store().setMode('speaking');
            }

            full += chunk;
            store().appendToMessage(state.messageId, chunk);
            state.onChunk?.(chunk);
          }
        } catch (nextError) {
          // A cadeia continua sozinha: a próxima falha volta a este mesmo
          // método, que tenta o provedor seguinte, ou esgota-se e cai no local.
          return await this.recover(nextError, { ...state, text: full });
        }

        this.noteModel(state.messageId);
        store().finishMessage(state.messageId);

        // Mesmo guarda do `send()`: se um pedido novo cancelou este durante a
        // troca de provedor, o modo e o controller já são dele.
        if (this.controller !== null && this.controller?.signal !== state.request.signal) {
          return full;
        }
        store().setMode('idle');
        if (this.controller?.signal === state.request.signal) this.controller = null;
        return full;
      }
    }

    const plan = planFallback({
      failure,
      isAborted: state.isAborted,
      hasText: state.text.trim().length > 0,
      isLocal: this.provider instanceof RuleProvider,
    });

    if (plan.action === 'nada') {
      store().finishMessage(state.messageId);
      store().setMode('idle');
      return state.text;
    }

    if (plan.action === 'nota') {
      store().appendToMessage(state.messageId, plan.note);
      state.onChunk?.(plan.note);
      store().finishMessage(state.messageId);
      store().setMode('error');
      return state.text + plan.note;
    }

    if (plan.action === 'erro') {
      store().appendToMessage(state.messageId, plan.note);
      state.onChunk?.(plan.note);
      store().finishMessage(state.messageId);
      store().setMode('error');
      return plan.note;
    }

    // Queda para o local. A nota vai primeiro, e o sinal é o do pedido
    // original: cancelar durante o fallback continua a cancelar.
    store().appendToMessage(state.messageId, plan.note);
    state.onChunk?.(plan.note);
    let full = plan.note;

    try {
      for await (const chunk of new RuleProvider().stream(state.request)) {
        if (state.request.signal?.aborted) break;
        full += chunk;
        store().appendToMessage(state.messageId, chunk);
        state.onChunk?.(chunk);
      }
    } catch {
      // O local não fala com ninguém, e por isso isto não devia acontecer. Se
      // acontecer, fica a nota — que já diz o que correu mal.
    }

    store().finishMessage(state.messageId);
    // `error` e não `idle`: alguma coisa correu mal, e o núcleo deve dizê-lo
    // mesmo que tenha havido resposta.
    store().setMode('error');
    logService.audit(`Assistente caiu para o provedor local (${failure.kind})`, 'executado');

    return full;
  }

  /**
   * Executa uma ferramenta que estava à espera de confirmação.
   *
   * Só a interface chama isto, e só depois de a pessoa ter dito que sim.
   */
  async confirmTool(call: ToolCall): Promise<void> {
    const outcome = await runTool(call, true);
    useAssistantStore.getState().addMessage('assistant', outcome.message);
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

/** Um provedor que sabe pedir e receber ferramentas — mesmo contrato `run`. */
type ToolCapableProvider = DeepSeekProvider | ClaudeProvider | OllamaProvider;

/**
 * A DeepSeek e o Claude sabem sempre pedir ferramentas. A Ollama só quando o
 * modelo escolhido for de uma família conhecida por suportar `tools` — ver
 * `OllamaProvider.supportsToolCalling`. Qualquer outro provedor (o
 * `RuleProvider`, por exemplo) nunca pede ferramentas.
 */
function isToolCapable(provider: AiProvider): provider is ToolCapableProvider {
  if (provider instanceof DeepSeekProvider) return true;
  if (provider instanceof ClaudeProvider) return true;
  if (provider instanceof OllamaProvider) return provider.supportsToolCalling();
  return false;
}

export const aiService = new AIService();
