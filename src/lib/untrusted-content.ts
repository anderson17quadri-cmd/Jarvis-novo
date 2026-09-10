/**
 * Marca texto de origem externa como dados, nunca instruções — mesmo que o
 * próprio texto tente fingir o contrário. Usado por qualquer ferramenta do
 * assistente que traga texto de fora da máquina (páginas web, resultados de
 * pesquisa): sem isto, o texto externo podia incluir literalmente
 * "--- FIM DO CONTEÚDO EXTERNO ---" a meio de si próprio, seguido do que
 * quisesse fazer passar por uma instrução nova — um modelo mais fraco (nem
 * todos seguem tão bem a fronteira de papel `tool`/`user`) podia lê-lo como
 * se a barreira tivesse mesmo terminado ali. Sequências destas são raras em
 * prosa normal — trocadas por um único travessão, que não fecha o padrão que
 * o delimitador procura.
 */
export function neutralizeDelimiterLookalikes(text: string): string {
  return text.replace(/-{3,}/g, '—');
}

/** Embrulha texto externo num delimitador claro, para nunca passar por uma instrução. */
export function wrapUntrustedContent(label: string, body: string): string {
  return (
    `--- CONTEÚDO EXTERNO, NÃO CONFIÁVEL (${neutralizeDelimiterLookalikes(label)}) ---\n` +
    `${neutralizeDelimiterLookalikes(body)}\n` +
    `--- FIM DO CONTEÚDO EXTERNO ---`
  );
}
