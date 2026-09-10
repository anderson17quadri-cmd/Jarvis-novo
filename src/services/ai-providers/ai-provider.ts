import type { AiProvider, AiRequest } from '@/types/assistant';

/**
 * Ponto de entrada dos provedores de IA.
 *
 * O contrato vive em `types/assistant.ts`; aqui só se reexporta, para que um
 * provedor novo importe de um sítio só. O único implementado é o
 * `RuleProvider` — ver `rule-provider.ts`.
 */
export type { AiProvider, AiRequest };
export { RuleProvider, answerFromContext } from './rule-provider';
