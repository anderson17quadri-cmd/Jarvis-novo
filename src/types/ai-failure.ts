/**
 * Falhas de um provedor de IA (Parte 12 §Regras de fallback).
 *
 * Antes disto, um erro de HTTP não era um erro: o provedor escrevia a frase
 * "A chave não foi aceite…" **como se fosse a resposta do modelo**. Ficava no
 * histórico da conversa, com o mesmo aspeto de tudo o resto, e o serviço não
 * tinha como saber que nada tinha corrido bem — logo, não tinha como reagir.
 *
 * Uma falha é uma exceção com um tipo. Quem apanha decide o que fazer com ela;
 * o provedor não decide nada, e é isso que permite haver fallback.
 */

export type AiFailureKind =
  /** A chave foi recusada (401, 403). */
  | 'chave'
  /** Não há saldo na conta (402). */
  | 'saldo'
  /** Pedidos a mais, seguidos (429). */
  | 'limite'
  /** O problema é do outro lado (5xx). */
  | 'servidor'
  /** Não se chegou lá: DNS, rede, CORS. */
  | 'rede'
  /** Demorou mais do que o tempo dado. */
  | 'demora'
  /** Respondeu, mas sem corpo. */
  | 'vazio'
  /** Falta a chave — não é uma falha da rede, é uma configuração por fazer. */
  | 'configuracao'
  /**
   * A permissão de rede do plugin "Assistente JARVIS" foi recusada na
   * Privacidade (Parte 14 §Permissões por plugin) — nunca chega a sair
   * nenhum pedido, ao contrário de todas as outras (essas já tentaram).
   */
  | 'permissao';

/** O que se diz a quem está à espera. Sem códigos, sem jargão. */
export const AI_FAILURE_REASONS: Record<AiFailureKind, string> = {
  chave: 'a chave não foi aceite',
  saldo: 'a conta não tem saldo',
  limite: 'foram pedidos demasiados seguidos',
  servidor: 'o serviço está com problemas do lado deles',
  rede: 'não consegui chegar lá',
  demora: 'demorou demasiado',
  vazio: 'respondeu sem conteúdo',
  configuracao: 'falta a chave',
  permissao: 'a permissão de rede do assistente está recusada',
};

/** O que a pessoa tem de fazer, quando há alguma coisa a fazer. */
export const AI_FAILURE_FIXES: Partial<Record<AiFailureKind, string>> = {
  chave: 'Verifique-a na Personalização, em Assistente.',
  saldo: 'Carregue a conta da DeepSeek.',
  configuracao: 'Abra a Personalização e cole a chave em Assistente.',
  limite: 'Espere um pouco antes de tentar outra vez.',
  permissao: 'Permita a rede ao "Assistente JARVIS" na Privacidade → Permissões.',
};

export class AiFailure extends Error {
  readonly kind: AiFailureKind;

  constructor(kind: AiFailureKind) {
    super(AI_FAILURE_REASONS[kind]);
    this.name = 'AiFailure';
    this.kind = kind;
  }
}

/**
 * Traduz um código HTTP.
 *
 * Um código que não se conhece conta como problema do servidor: é a leitura
 * mais provável, e a que leva a tentar outra vez em vez de mandar a pessoa
 * mexer numa chave que está boa.
 */
export function failureFromStatus(status: number): AiFailure {
  if (status === 401 || status === 403) return new AiFailure('chave');
  if (status === 402) return new AiFailure('saldo');
  if (status === 429) return new AiFailure('limite');
  return new AiFailure('servidor');
}

/**
 * O que fazer quando o provedor falha.
 *
 * `nada` — não se diz nada: quem cancelou já sabe que cancelou.
 * `nota` — acrescenta-se uma linha ao que já estava escrito. É o caso de uma
 *          resposta que se perdeu a meio: trocá-la por outra, vinda de outro
 *          provedor, dava um texto que muda de voz a meio da frase.
 * `local` — responde-se com o provedor local, com a nota à frente.
 * `erro` — a nota é a resposta. Acontece quando já se está no local e não há
 *          para onde cair.
 */
export interface FallbackPlan {
  readonly action: 'nada' | 'nota' | 'local' | 'erro';
  readonly note: string;
}

export interface FallbackInput {
  readonly failure: AiFailure;
  /** Foi a pessoa que cancelou. */
  readonly isAborted: boolean;
  /** Já tinha chegado alguma coisa da resposta. */
  readonly hasText: boolean;
  /** O provedor que falhou já era o local — não há para onde cair. */
  readonly isLocal: boolean;
}

export function planFallback(input: FallbackInput): FallbackPlan {
  if (input.isAborted) return { action: 'nada', note: '' };

  const reason = AI_FAILURE_REASONS[input.failure.kind];
  const fix = AI_FAILURE_FIXES[input.failure.kind];

  if (input.hasText) {
    return { action: 'nota', note: `\n\n— A resposta ficou a meio: ${reason}.` };
  }

  if (input.isLocal) {
    return { action: 'erro', note: `Não consegui responder: ${reason}.${fix ? ` ${fix}` : ''}` };
  }

  /*
   * A nota vai **sempre**, e é a parte que interessa.
   *
   * Um fallback silencioso é pior do que uma falha: a pessoa lê uma resposta
   * mais fraca, não percebe porquê, e nunca chega a saber que a chave está
   * errada há três dias.
   */
  return {
    action: 'local',
    note: `O modelo remoto não respondeu — ${reason}.${fix ? ` ${fix}` : ''} Respondo com o que sei daqui:\n\n`,
  };
}
