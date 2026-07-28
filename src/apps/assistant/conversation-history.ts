import { sortConversations } from '@/stores/use-assistant-store';
import type { AssistantConversation } from '@/types/assistant';

/**
 * Categorias do histórico (Parte 7.1 §Histórico).
 *
 * As categorias são por tempo, não por assunto. Classificar por assunto sem
 * modelo ligado seria adivinhar; "hoje" e "ontem" são verificáveis.
 */

export interface ConversationGroup {
  readonly label: string;
  readonly conversations: readonly AssistantConversation[];
}

const DAY_MS = 24 * 60 * 60_000;

/** Início do dia de uma data — a comparação é por dia de calendário, não por 24h. */
function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function groupConversations(
  conversations: readonly AssistantConversation[],
  now: number = Date.now(),
): readonly ConversationGroup[] {
  const today = startOfDay(now);

  const pinned: AssistantConversation[] = [];
  const buckets = new Map<string, AssistantConversation[]>([
    ['Hoje', []],
    ['Ontem', []],
    ['Últimos 7 dias', []],
    ['Mais antigas', []],
  ]);

  for (const conversation of sortConversations(conversations)) {
    if (conversation.isPinned) {
      pinned.push(conversation);
      continue;
    }

    const day = startOfDay(conversation.updatedAt);
    const label =
      day >= today
        ? 'Hoje'
        : day >= today - DAY_MS
          ? 'Ontem'
          : day >= today - 6 * DAY_MS
            ? 'Últimos 7 dias'
            : 'Mais antigas';

    buckets.get(label)?.push(conversation);
  }

  const groups: ConversationGroup[] = [];
  if (pinned.length > 0) groups.push({ label: 'Fixadas', conversations: pinned });

  // Um grupo vazio não entra: uma etiqueta "Ontem" sem nada por baixo só ocupa
  // espaço e faz parecer que se perdeu qualquer coisa.
  for (const [label, entries] of buckets) {
    if (entries.length > 0) groups.push({ label, conversations: entries });
  }

  return groups;
}

/** Filtra por texto, no título e no que foi escrito. */
export function searchConversations(
  conversations: readonly AssistantConversation[],
  query: string,
): readonly AssistantConversation[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return conversations;

  return conversations.filter(
    (conversation) =>
      conversation.title.toLowerCase().includes(needle) ||
      conversation.messages.some((message) => message.text.toLowerCase().includes(needle)),
  );
}

/** Só as que têm alguma mensagem marcada como favorita. */
export function onlyWithFavourites(
  conversations: readonly AssistantConversation[],
): readonly AssistantConversation[] {
  return conversations.filter((conversation) =>
    conversation.messages.some((message) => message.isFavourite),
  );
}
