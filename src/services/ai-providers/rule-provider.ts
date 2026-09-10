import { describeContext, greetingFor } from '../assistant/context';
import { extractPreference, MEMORY_LABELS } from '../assistant/memory-service';
import type { AiProvider, AiRequest, AssistantContext, AssistantMemory } from '@/types/assistant';

/**
 * O provedor da Fase 1.
 *
 * Substitui o antigo `MockProvider`, que respondia sempre a mesma coisa. Este
 * responde **a sério** ao que sabe mesmo: a hora, a meteorologia, as janelas
 * abertas, as notificações por ler e o que a memória guardou. Ao que não sabe,
 * responde uma frase de espera — e diz que está a responder sem modelo ligado,
 * em vez de deixar parecer que há um.
 *
 * Continua a cumprir a mesma interface de um provedor real: streaming pedaço a
 * pedaço, cancelável. Ligar o OpenAI, o Claude ou o Ollama é escrever uma
 * classe e registá-la — nenhum componente muda.
 */

/** Quando nada corresponde. Rotativas, para não parecer um gravador. */
const FALLBACKS = [
  'Ainda não tenho um modelo de linguagem ligado, por isso não vou fingir uma resposta. Do que sei do sistema — hora, meteorologia, janelas abertas, notificações e o que me pediu para guardar — posso responder já.',
  'Essa não consigo. Sem provedor de IA configurado, respondo ao que leio do próprio sistema. Pergunte-me as horas, o tempo, o que tem aberto ou de que me lembro.',
  'Fica registado, mas não tenho como a tratar sem um modelo ligado. Entretanto, o contexto do sistema está todo à mão.',
] as const;

/** Ritmo da escrita, por carácter. */
const CHUNK_DELAY_MS = 9;
const CHUNK_JITTER_MS = 14;

/** Pausa antes do primeiro pedaço — é o tempo em que o núcleo mostra "a analisar". */
const THINKING_MIN_MS = 420;
const THINKING_JITTER_MS = 380;

export class RuleProvider implements AiProvider {
  readonly id = 'regras';
  readonly name = 'Contexto local';
  readonly isRemote = false;

  private fallbackIndex = 0;

  isConfigured(): boolean {
    return true;
  }

  async *stream(request: AiRequest): AsyncIterable<string> {
    const reply = this.answer(request);

    await delay(THINKING_MIN_MS + Math.random() * THINKING_JITTER_MS, request.signal);

    for (const character of reply) {
      if (request.signal?.aborted) return;
      await delay(CHUNK_DELAY_MS + Math.random() * CHUNK_JITTER_MS, request.signal);
      yield character;
    }
  }

  private answer(request: AiRequest): string {
    const answer = answerFromContext(request.prompt, request.context, request.memory);
    if (answer !== null) return answer;

    const fallback = FALLBACKS[this.fallbackIndex % FALLBACKS.length] ?? FALLBACKS[0];
    this.fallbackIndex += 1;
    return fallback;
  }
}

/**
 * A resposta, ou `null` quando não há nada de concreto a dizer.
 *
 * Pura de propósito: é aqui que está toda a lógica que vale a pena testar, e
 * testá-la não deve exigir esperar pelo streaming.
 */
export function answerFromContext(
  prompt: string,
  context: AssistantContext | null,
  memory: AssistantMemory,
): string | null {
  const text = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (text.length === 0) return null;

  // ── Memória ────────────────────────────────────────────────────────────────

  if (/\b(de que te lembras|o que sabes de mim|o que te lembras|a tua memoria)\b/.test(text)) {
    return describeMemory(memory);
  }

  // A preferência é lida do pedido original, com acentos: a normalização acima
  // serve para reconhecer perguntas, não para guardar nomes de gente sem til.
  const learned = extractPreference(prompt);

  if (learned !== null) {
    const label = (MEMORY_LABELS[learned.key] ?? learned.key).toLowerCase();
    return `Ficou guardado: ${label} ${learned.value}. Fica no dispositivo, e pode apagá-lo na aba de memória.`;
  }

  // ── Contexto ───────────────────────────────────────────────────────────────

  if (context === null) return null;

  if (/\b(que horas|horas sao|a hora)\b/.test(text)) {
    const hours = context.now.getHours().toString().padStart(2, '0');
    const minutes = context.now.getMinutes().toString().padStart(2, '0');
    return `São ${hours}:${minutes}.`;
  }

  if (/\b(que dia|a data|hoje e)\b/.test(text)) {
    return `Hoje é ${new Intl.DateTimeFormat('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(context.now)}.`;
  }

  if (/\b(tempo|meteorologia|clima|temperatura|chuva|calor|frio)\b/.test(text)) {
    if (!context.weather) {
      return 'Ainda não recebi leitura de meteorologia. O provedor real precisa de rede, que está bloqueada até a Fase 1 correr no PC.';
    }
    return `Em ${context.weather.location} estão ${context.weather.temperatureC}° e ${context.weather.label.toLowerCase()}.`;
  }

  if (/\b(janelas?|abertas?|aberto)\b/.test(text)) {
    if (context.openWindows.length === 0) return 'Não tem nenhuma janela aberta.';
    return context.openWindows.length === 1
      ? `Tem aberta a janela ${context.openWindows[0]}.`
      : `Tem ${context.openWindows.length} janelas abertas: ${context.openWindows.join(', ')}.`;
  }

  // `notificac\w*` apanha "notificação" e "notificações" — sem o `\w*`, o `\b`
  // final caía no meio da palavra e nunca correspondia.
  if (/\b(notificac\w*|avisos?|por ler)\b/.test(text)) {
    if (context.unreadNotifications === 0) return 'Não tem notificações por ler.';
    return context.unreadNotifications === 1
      ? 'Tem uma notificação por ler.'
      : `Tem ${context.unreadNotifications} notificações por ler.`;
  }

  if (/\b(estado do sistema|em que modo|modo atual|que tema)\b/.test(text)) {
    return `O sistema está em modo ${context.systemState}, com o tema ${context.theme}.`;
  }

  if (/\b(ola|bom dia|boa tarde|boa noite|estas ai|resumo|ponto de situacao)\b/.test(text)) {
    const name = memory.preferences['nome'] ?? context.userName;
    const greeting = greetingFor(context.now.getHours());
    return `${greeting}${name !== null && name !== undefined ? `, ${name}` : ''}. ${describeContext(context)}`;
  }

  return null;
}

function describeMemory(memory: AssistantMemory): string {
  const entries = Object.entries(memory.preferences);

  if (entries.length === 0 && memory.recentPrompts.length === 0) {
    return 'Ainda não guardei nada. Diga-me "trata-me por…" ou "moro em…" e fica registado no dispositivo.';
  }

  const parts: string[] = [];

  if (entries.length > 0) {
    parts.push(
      `Sei isto de si: ${entries
        .map(([key, value]) => `${(MEMORY_LABELS[key] ?? key).toLowerCase()} ${value}`)
        .join('; ')}.`,
    );
  }

  if (memory.recentPrompts.length > 0) {
    parts.push(
      `O último pedido foi "${memory.recentPrompts[0]}", e guardo os ${memory.recentPrompts.length} mais recentes.`,
    );
  }

  return parts.join(' ');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
