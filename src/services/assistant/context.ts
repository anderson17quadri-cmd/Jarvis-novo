import type { AssistantContext } from '@/types/assistant';

/**
 * Contexto do assistente (Parte 7.2 §Contexto).
 *
 * Quem monta o contexto é a aplicação, que já conhece as stores todas; o
 * serviço só recebe uma função e chama-a. É o mesmo padrão do executor das
 * automações e do de voz, e pela mesma razão: sem isto, o `AIService`
 * importava seis stores e a meteorologia, e testá-lo exigia montar o sistema.
 */

export type AssistantContextSource = () => AssistantContext;

let source: AssistantContextSource | null = null;

/** Regista a fonte. Devolve a função que a retira. */
export function setContextSource(next: AssistantContextSource): () => void {
  source = next;

  return () => {
    // Só limpar se ainda for esta — desmontar um componente antigo não pode
    // apagar a fonte que outro registou entretanto.
    if (source === next) source = null;
  };
}

/** O presente, ou `null` se ninguém registou uma fonte. */
export function readContext(): AssistantContext | null {
  return source?.() ?? null;
}

/** Saudação pela hora do dia. */
export function greetingFor(hour: number): string {
  if (hour < 6) return 'Boa madrugada';
  if (hour < 13) return 'Bom dia';
  if (hour < 20) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * O contexto em texto corrido, para o assistente o poder dizer.
 *
 * Cada linha só entra se houver mesmo alguma coisa a dizer: uma linha
 * "0 janelas abertas" não informa ninguém.
 */
export function describeContext(context: AssistantContext): string {
  const lines: string[] = [];
  const hours = context.now.getHours().toString().padStart(2, '0');
  const minutes = context.now.getMinutes().toString().padStart(2, '0');

  lines.push(`São ${hours}:${minutes}.`);

  if (context.weather) {
    lines.push(
      `Em ${context.weather.location} está ${context.weather.temperatureC}° e ${context.weather.label.toLowerCase()}.`,
    );
  }

  if (context.openWindows.length > 0) {
    lines.push(
      context.openWindows.length === 1
        ? `Tem aberta a janela ${context.openWindows[0]}.`
        : `Tem ${context.openWindows.length} janelas abertas: ${context.openWindows.join(', ')}.`,
    );
  }

  if (context.unreadNotifications > 0) {
    lines.push(
      context.unreadNotifications === 1
        ? 'Tem uma notificação por ler.'
        : `Tem ${context.unreadNotifications} notificações por ler.`,
    );
  }

  if (context.systemState !== 'normal') {
    lines.push(`O sistema está em modo ${context.systemState}.`);
  }

  return lines.join(' ');
}
