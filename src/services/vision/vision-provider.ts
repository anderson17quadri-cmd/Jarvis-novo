import type { VisionProviderId } from '@/types/ai-provider-settings';

/**
 * Um modelo que sabe olhar para um print e dizer o que lá está (Fase 3.5).
 *
 * É uma abstração à parte do `AiProvider` de propósito: aquele é texto-e-
 * ferramentas, em streaming; este é uma imagem a entrar e uma descrição a
 * sair, de uma vez. Misturar os dois faria um contrato com metade dos métodos
 * sem sentido para o outro lado.
 *
 * A decisão de privacidade está na escolha do provedor, não aqui: o Ollama é
 * local (o print nunca sai da máquina) e o Claude é remoto (sai, a pedido
 * explícito). A interface de Privacidade apresenta os dois, com a omissão a
 * favor do local.
 */

/** O que se pede ao modelo de visão — a mesma pergunta, os dois provedores. */
export const VISION_PROMPT =
  'Descreve o que está visível neste ecrã, em português e de forma concisa. ' +
  'Foca-te no que se pode fazer: janelas abertas, botões, campos, menus, mensagens de erro. ' +
  'Para cada elemento com que se possa interagir (clicar, escrever), indica a posição ' +
  'aproximada em píxeis (x, y) a contar do canto superior esquerdo.';

export interface VisionProvider {
  readonly id: VisionProviderId;
  readonly name: string;
  /** `true` quando o print sai da máquina — só o Claude, hoje. */
  readonly isRemote: boolean;

  isConfigured(): boolean;

  /**
   * Devolve a descrição do print (PNG em base64), ou lança uma `AiFailure`
   * tipada — o mesmo contrato de falha dos provedores de texto, para quem
   * chama decidir o que dizer sem ter de interpretar texto de erro.
   */
  describe(imageBase64: string, signal?: AbortSignal): Promise<string>;
}
