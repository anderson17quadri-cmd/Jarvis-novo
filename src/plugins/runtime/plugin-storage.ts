/**
 * O namespace de armazenamento de cada plugin.
 *
 * O armazenamento dos plugins vive no mesmo `jarvis.store.json` que o resto
 * do sistema, por isso a fronteira entre um plugin e outro — e entre um
 * plugin e as preferências do próprio JARVIS — é este prefixo. Tudo o que um
 * plugin guarda fica debaixo de `plugins:<id>:`: o `id` é o namespace, e
 * nenhum plugin escreve ou lê fora dele porque a chave é sempre derivada
 * aqui, num único sítio.
 *
 * Antes, o prefixo estava escrito à mão em seis sítios de `plugin-bridge.ts`;
 * qualquer capacidade futura que se esquecesse de o aplicar abriria um buraco
 * silencioso — um plugin a ler ou escrever nas preferências do sistema ou na
 * de outro plugin. Centralizar não acrescenta isolamento novo (já existia),
 * torna-o impossível de esquecer.
 */

const PLUGIN_STORAGE_NAMESPACE = 'plugins';

/**
 * O formato aceite para o identificador de um plugin: letras minúsculas,
 * dígitos, hífen e sublinhado. Sem dois pontos — ver `pluginStorageKey`.
 *
 * Todos os plugins reais já respeitam isto (`core-assistant`,
 * `guarda-preferencias`, `ola-notificacao`…); a regra só fecha a porta a um
 * identificador construído de propósito para colidir.
 */
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** `true` se o identificador respeita o formato de slug esperado. */
export function isValidPluginId(id: string): boolean {
  return PLUGIN_ID_PATTERN.test(id);
}

/**
 * Deriva a chave real de armazenamento de um plugin: `plugins:<id>:<chave>`.
 *
 * A `chave` vem do plugin e é validada à porta (em `protocol.ts`) como string
 * não vazia; aqui aplica-se o namespace. Um plugin que peça
 * `chave: "outro:segredo"` continua a escrever no próprio namespace
 * (`plugins:<id>:outro:segredo`), nunca no de outro plugin.
 *
 * **O `id` é codificado, e isso não é decoração.** A chave é texto com `:` a
 * separar os três pedaços, por isso um `:` *dentro* do id desloca a fronteira:
 * o plugin `notas` a guardar a chave `x:y` e o plugin `notas:x` a guardar a
 * chave `y` produziam, os dois, `plugins:notas:x:y` — a mesma chave. O segundo
 * lia e escrevia por cima dos dados privados do primeiro, e o isolamento que
 * este módulo existe para garantir caía sem dar sinal. Codificar o id fecha
 * isso pela estrutura, não pela confiança: `notas:x` vira `notas%3Ax`, que já
 * não colide com nada.
 *
 * `encodeURIComponent` é a identidade para um id em formato de slug (ver
 * `isValidPluginId`), por isso nenhuma chave já guardada muda de sítio — não
 * há migração de dados a fazer.
 */
export function pluginStorageKey(pluginId: string, chave: string): string {
  return `${PLUGIN_STORAGE_NAMESPACE}:${encodeURIComponent(pluginId)}:${chave}`;
}
