/**
 * Resolução de referências ambíguas ("esse ficheiro", "isso") usando o
 * provedor de IA — sem regras escritas à mão.
 *
 * Quando o utilizador diz "abre esse ficheiro" depois de o assistente ter
 * mencionado um ficheiro específico, o modelo resolve a referência contra o
 * histórico da conversa e devolve o pedido com a ambiguidade desfeita.
 *
 * Exemplo:
 *   Histórico: "Criei o ficheiro orcamento-2026.xlsx na pasta Documentos."
 *   Pedido:    "abre esse ficheiro"
 *   Resolvido: "abre o ficheiro orcamento-2026.xlsx na pasta Documentos"
 */

import type { AiProvider, AiRequest, AssistantMessage } from '@/types/assistant';

/**
 * Constrói um `AiRequest` mínimo para o pedido de resolução.
 *
 * Com `exactOptionalPropertyTypes: true`, o `signal` não pode ser `undefined`
 * — ou está presente ou não, e o espalhamento condicional resolve isso.
 */
function resolutionRequest(prompt: string, signal?: AbortSignal): AiRequest {
  const base: AiRequest = {
    prompt,
    history: [],
    context: null,
    memory: { preferences: {}, recentPrompts: [] },
  };
  if (signal) {
    return { ...base, signal };
  }
  return base;
}

/**
 * Palavras que podem indicar uma referência a algo dito antes.
 *
 * Usadas só para evitar uma ida ao modelo quando o pedido não tem nada que
 * pareça uma referência — a resolução em si é sempre feita pelo modelo, nunca
 * por correspondência de padrões.
 */
const VAGUE_REFERENCE_PATTERN =
  /\b(ess[ae]s?|iss[oa]|ist[oa]|aquil[oa]|aquel[ae]s?|nisso|nis[ot]|naquil[oa]|deles?|delas?|o mesmo|a mesma|l[áa]|a[ií])\b/i;

/**
 * Chama o provedor de IA para resolver referências ambíguas no `prompt` com
 * base no `history` da conversa.
 *
 * Devolve o pedido resolvido, ou o original se não houver referências para
 * resolver ou se o provedor não conseguir.
 */
export async function resolveReferences(
  prompt: string,
  history: readonly AssistantMessage[],
  provider: AiProvider,
  signal?: AbortSignal,
): Promise<string> {
  // Otimização: se o pedido não tem palavras que indiquem referências, nem
  // vale a pena ir ao modelo. A validação é uma heurística, não uma regra —
  // o modelo é que decide o que é ou não uma referência a resolver.
  if (!VAGUE_REFERENCE_PATTERN.test(prompt)) return prompt;

  // Sem histórico, não há onde resolver.
  const relevantHistory = history.filter((msg) => msg.text.trim().length > 0);
  if (relevantHistory.length === 0) return prompt;

  const historyText = relevantHistory
    .slice(-6) // Só as últimas 6 trocas — referências a coisas muito antigas são improváveis.
    .map((msg) => `${msg.author === 'user' ? 'Pessoa' : 'JARVIS'}: ${msg.text}`)
    .join('\n');

  const resolutionPrompt = [
    'Abaixo está o histórico de uma conversa entre uma pessoa e o assistente JARVIS.',
    'A última mensagem da pessoa tem uma referência ambígua ("esse", "isso", "aquele", etc.) que só se percebe com o contexto do que foi dito antes.',
    '',
    'Devolve APENAS a mensagem da pessoa com a referência resolvida — sem mais texto, sem aspas, sem formatação. Se não houver referência ambígua, devolve a mensagem exatamente como está.',
    '',
    'Histórico:',
    historyText,
    '',
    `Mensagem: ${prompt}`,
    '',
    'Mensagem resolvida:',
  ].join('\n');

  try {
    let resolved = '';
    for await (const chunk of provider.stream(resolutionRequest(resolutionPrompt, signal))) {
      resolved += chunk;
    }

    const cleaned = resolved.trim();
    // Se o modelo devolveu algo substancialmente diferente, usa-o.
    // Senão, fica o original — melhor o ambíguo do que o inventado.
    if (cleaned.length > 0 && cleaned !== prompt) {
      return cleaned;
    }
  } catch {
    // Se a resolução falhar, o pedido original segue — uma referência por
    // resolver é melhor do que um pedido que nunca chega a ser respondido.
  }

  return prompt;
}

/**
 * Versão para teste que não depende de um provedor real.
 *
 * Aceita uma função de resolução injetada, para o teste poder simular o
 * comportamento do modelo sem depender de rede ou chaves.
 */
export async function resolveReferencesWith(
  prompt: string,
  history: readonly AssistantMessage[],
  resolver: (prompt: string, historyText: string) => Promise<string>,
): Promise<string> {
  if (!VAGUE_REFERENCE_PATTERN.test(prompt)) return prompt;

  const relevantHistory = history.filter((msg) => msg.text.trim().length > 0);
  if (relevantHistory.length === 0) return prompt;

  const historyText = relevantHistory
    .slice(-6)
    .map((msg) => `${msg.author === 'user' ? 'Pessoa' : 'JARVIS'}: ${msg.text}`)
    .join('\n');

  if (historyText.length === 0) return prompt;

  try {
    const resolved = await resolver(prompt, historyText);
    const cleaned = resolved.trim();
    if (cleaned.length > 0 && cleaned !== prompt) return cleaned;
  } catch {
    // Queda silenciosa.
  }

  return prompt;
}
