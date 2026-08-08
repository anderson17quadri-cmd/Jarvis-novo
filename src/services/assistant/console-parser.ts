import { getTool, validateArgs, type ToolDefinition } from './tools';
import type { ToolCall } from './tool-runner';

/**
 * Consola de comandos (Parte 16 §Consola de comandos).
 *
 * A Command Palette já executa — mas por pesquisa, sobre uma lista fixa. Isto
 * é o oposto: uma linha de texto, com o catálogo inteiro de ferramentas do
 * assistente (`tools.ts`), incluindo as que a voz e a paleta nunca alcançam
 * (`guardar_layout`, `ligar_automacao`, as destrutivas…). É a mesma via que o
 * modelo usa para agir — só que escrita à mão, sem passar pela DeepSeek.
 *
 * Sintaxe: `ferramenta chave=valor chave2="valor com espaços"`. Sem vírgulas,
 * sem dois pontos — o suficiente para testar uma ferramenta sem abrir o
 * código, e nada mais do que isso.
 */

export interface ParsedLine {
  readonly name: string;
  readonly args: Readonly<Record<string, string>>;
}

export type ParseResult =
  | { readonly ok: true; readonly line: ParsedLine }
  | { readonly ok: false; readonly problem: string };

/**
 * Divide a linha em tokens, respeitando aspas simples ou duplas.
 *
 * `titulo="comprar leite e pão"` sai como um só token — `titulo=comprar leite
 * e pão` — porque as aspas deixam passar o espaço sem fechar o token, e não
 * porque houve um `split(' ')` com sorte.
 */
export function tokenize(text: string): readonly string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index]!)) index += 1;
    if (index >= text.length) break;

    let token = '';
    while (index < text.length && !/\s/.test(text[index]!)) {
      const char = text[index]!;

      if (char === '"' || char === "'") {
        const quote = char;
        index += 1;
        while (index < text.length && text[index] !== quote) {
          token += text[index];
          index += 1;
        }
        index += 1; // salta a aspa de fecho, se houver
      } else {
        token += char;
        index += 1;
      }
    }

    tokens.push(token);
  }

  return tokens;
}

export function parseLine(text: string): ParseResult {
  const tokens = tokenize(text);
  const [name, ...rest] = tokens;

  if (!name) {
    return { ok: false, problem: 'Escreva o nome de uma ferramenta. "ajuda" lista o catálogo.' };
  }

  const args: Record<string, string> = {};

  for (const token of rest) {
    const at = token.indexOf('=');
    if (at <= 0) {
      return { ok: false, problem: `Argumento inválido: "${token}". Use chave=valor.` };
    }

    args[token.slice(0, at)] = token.slice(at + 1);
  }

  return { ok: true, line: { name, args } };
}

export type BuildResult =
  | { readonly ok: true; readonly call: ToolCall }
  | { readonly ok: false; readonly problem: string };

/**
 * Transforma uma linha interpretada numa chamada tipada.
 *
 * Três coisas que só uma consola escrita à mão precisa de verificar, e que o
 * `validateArgs` não vê porque recebe já texto: uma chave que a ferramenta não
 * conhece, um número que não é número, um booleano que não é `true`/`false`. O
 * resto — obrigatórios em falta, valores fora das opções — é o mesmo
 * `validateArgs` que trava o que o modelo manda.
 */
export function buildCall(id: string, line: ParsedLine): BuildResult {
  const tool = getTool(line.name);

  if (!tool) {
    return { ok: false, problem: `Não conheço a ferramenta "${line.name}". Escreva "ajuda".` };
  }

  const known = new Set(tool.parameters.map((parameter) => parameter.name));
  for (const key of Object.keys(line.args)) {
    if (known.has(key)) continue;

    const expected = tool.parameters.map((parameter) => parameter.name).join(', ') || '(nenhum)';
    return { ok: false, problem: `Argumento desconhecido: "${key}". Esperados: ${expected}.` };
  }

  const args: Record<string, unknown> = {};

  for (const parameter of tool.parameters) {
    const raw = line.args[parameter.name];
    if (raw === undefined) continue;

    if (parameter.type === 'number') {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        return { ok: false, problem: `"${parameter.name}" tem de ser um número — recebi "${raw}".` };
      }
      args[parameter.name] = value;
      continue;
    }

    if (parameter.type === 'boolean') {
      const normalized = raw.toLowerCase();
      if (normalized !== 'true' && normalized !== 'false') {
        return {
          ok: false,
          problem: `"${parameter.name}" tem de ser "true" ou "false" — recebi "${raw}".`,
        };
      }
      args[parameter.name] = normalized === 'true';
      continue;
    }

    args[parameter.name] = raw;
  }

  const invalid = validateArgs(tool, args);
  if (invalid) return { ok: false, problem: invalid };

  return { ok: true, call: { id, name: tool.name, args } };
}

/** Descreve um parâmetro para o texto de ajuda. */
export function describeParameter(parameter: ToolDefinition['parameters'][number]): string {
  const kind = parameter.options ? parameter.options.join('|') : parameter.type;
  return `${parameter.name}${parameter.required ? '' : '?'}: ${kind}`;
}
