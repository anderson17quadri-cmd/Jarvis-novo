/**
 * Identidade de quem usa o sistema.
 *
 * Fixa na Fase 1: não há contas, não há registo e não há de onde a ler. Está
 * num sítio só porque estava escrita em três — o login, o header e o
 * assistente — e três cópias divergem à primeira alteração.
 *
 * Quando houver contas a sério, isto passa a vir da sessão e este ficheiro
 * desaparece. Até lá, a memória do assistente sobrepõe-se-lhe: quem disser
 * "trata-me por…" passa a ser tratado assim.
 */
export const USER_NAME = 'Anderson Quadri';

/** O primeiro nome, que é por onde o assistente trata quem o usa. */
export const USER_FIRST_NAME = 'Anderson';
