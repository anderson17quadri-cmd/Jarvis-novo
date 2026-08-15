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
 * Deriva a chave real de armazenamento de um plugin: `plugins:<id>:<chave>`.
 *
 * A `chave` vem do plugin e é validada à porta (em `protocol.ts`) como string
 * não vazia; aqui só se aplica o namespace. Um plugin que peça
 * `chave: "outro:segredo"` continua a escrever no próprio namespace
 * (`plugins:<id>:outro:segredo`), nunca no de outro plugin.
 */
export function pluginStorageKey(pluginId: string, chave: string): string {
  return `${PLUGIN_STORAGE_NAMESPACE}:${pluginId}:${chave}`;
}
