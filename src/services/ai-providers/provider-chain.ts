import { AI_FAILURE_REASONS, type AiFailure } from '@/types/ai-failure';
import type { AiProvider } from '@/types/assistant';

/**
 * Cadeia de provedores (Parte 12 §Orquestrador multi-provedor).
 *
 * O pedido do utilizador: escolher o melhor provedor sozinho, e quando um
 * fica sem saldo (ou sem chave, ou de rastos), avisar e saltar para o
 * seguinte automaticamente — sem esperar que alguém vá mudar as
 * configurações a meio de uma conversa.
 *
 * A ordem é uma lista, da primeira escolha para a última linha de reserva.
 * Cada entrada só entra na procura se `isConfigured()` for verdade — um
 * provedor sem chave nem aparece na cadeia, não é tentado e depois descartado.
 *
 * O `RuleProvider` não faz parte desta lista: continua a ser o abrigo final,
 * tratado à parte pelo que já existe em `planFallback` — este ficheiro só
 * decide entre os provedores "de verdade".
 */

export interface ChainMember {
  readonly provider: AiProvider;
  /** Nome a mostrar nas notificações de troca. Vem do próprio provedor. */
  readonly name: string;
}

export interface ChainStep {
  readonly action: 'tentar' | 'esgotado';
  readonly member?: ChainMember;
  /** Frase pronta para uma notificação — nunca vazia, nunca silenciosa. */
  readonly notice: string;
}

/** Os membros da cadeia que têm mesmo como responder agora. */
export function configuredChain(chain: readonly ChainMember[]): readonly ChainMember[] {
  return chain.filter((member) => member.provider.isConfigured());
}

/**
 * O primeiro da cadeia com quem se pode contar.
 *
 * `null` quando nenhum provedor está configurado — nesse caso quem chama cai
 * direto no `RuleProvider`, sem sequer começar a andar pela cadeia.
 */
export function firstInChain(chain: readonly ChainMember[]): ChainMember | null {
  return configuredChain(chain)[0] ?? null;
}

/**
 * O que fazer depois de um provedor da cadeia falhar.
 *
 * Recebe o nome de quem falhou (não o índice: a cadeia pode ter sido
 * reordenada nas configurações entre um pedido e outro, e procurar pelo nome
 * em vez de por posição evita saltar o membro errado). Um provedor apanhado
 * `isAborted` não gera aviso nenhum — quem cancelou já sabe.
 */
export function nextStep(
  chain: readonly ChainMember[],
  failedName: string,
  failure: AiFailure,
  isAborted: boolean,
): ChainStep {
  if (isAborted) return { action: 'esgotado', notice: '' };

  const reason = AI_FAILURE_REASONS[failure.kind];
  const configured = configuredChain(chain);
  const failedAt = configured.findIndex((member) => member.name === failedName);
  const remaining = configured.slice(failedAt + 1);
  const next = remaining[0];

  if (next) {
    return {
      action: 'tentar',
      member: next,
      notice: `${failedName}: ${reason} — a passar para ${next.name}.`,
    };
  }

  return {
    action: 'esgotado',
    notice: `${failedName}: ${reason}. Não há mais nenhum provedor configurado — a responder com o que sei localmente.`,
  };
}
