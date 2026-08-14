/**
 * Corta um texto em frases completas à medida que ele chega aos bocados
 * (Parte 7.2 §Assistente, resposta em streaming) — item 16 reportado ao
 * vivo pelo utilizador: falar só depois de o texto inteiro estar escrito
 * soa a atraso; falar frase a frase, à medida que cada uma fecha, não.
 *
 * `.`/`!`/`?` (um ou repetidos, como "...") seguidos de espaço ou do fim
 * do texto fecham uma frase — exceto logo a seguir a uma abreviatura
 * comum, onde fechar ali partia a frase sem necessidade.
 */

const FIM_DE_FRASE = /[.!?]+(?=\s|$)/g;

const ABREVIATURAS = new Set([
  'sr', 'sra', 'dr', 'dra', 'eng', 'prof', 'exmo', 'exma', 'etc', 'ex', 'n.º', 'nº', 'vs',
]);

function terminaEmAbreviatura(textoAntesDaPontuacao: string): boolean {
  const palavra = /(\p{L}+)$/u.exec(textoAntesDaPontuacao)?.[1];
  return palavra !== undefined && ABREVIATURAS.has(palavra.toLowerCase());
}

/**
 * Devolve as frases já fechadas em `buffer`, mais o que sobra por fechar —
 * o resto junta-se ao próximo bocado que chegar antes de se voltar a
 * chamar isto.
 *
 * `final` só é `true` quando o `buffer` é o último bocado (o stream acabou).
 * A meio, a pontuação mesmo no fim do buffer fica por fechar: "3." tanto
 * pode ser fim de frase como metade de "3.14", e sem o bocado seguinte não
 * há como distinguir. Só com `final: true` é que o fim do buffer conta como
 * fim de frase.
 */
export function extractSentences(
  buffer: string,
  final = true,
): { readonly sentences: readonly string[]; readonly remainder: string } {
  const sentences: string[] = [];
  let start = 0;
  let searchFrom = 0;

  while (searchFrom < buffer.length) {
    FIM_DE_FRASE.lastIndex = searchFrom;
    const match = FIM_DE_FRASE.exec(buffer);
    if (match === null) break;

    const fimDaPontuacao = match.index + match[0].length;

    if (!final && fimDaPontuacao === buffer.length) break;

    if (terminaEmAbreviatura(buffer.slice(start, match.index))) {
      searchFrom = fimDaPontuacao;
      continue;
    }

    const frase = buffer.slice(start, fimDaPontuacao).trim();
    if (frase.length > 0) sentences.push(frase);
    start = fimDaPontuacao;
    searchFrom = fimDaPontuacao;
  }

  return { sentences, remainder: buffer.slice(start) };
}
