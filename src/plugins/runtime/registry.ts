import abreJanelaSource from '@/plugins/examples/abre-janela/plugin.js?raw';
import adicionaMenuSource from '@/plugins/examples/adiciona-menu/plugin.js?raw';
import adicionaPainelSource from '@/plugins/examples/adiciona-painel/plugin.js?raw';
import criaServicoSource from '@/plugins/examples/cria-servico/plugin.js?raw';
import criaWidgetSource from '@/plugins/examples/cria-widget/plugin.js?raw';
import disparaAutomacaoSource from '@/plugins/examples/dispara-automacao/plugin.js?raw';
import escutaEventosSource from '@/plugins/examples/escuta-eventos/plugin.js?raw';
import executaVozSource from '@/plugins/examples/executa-voz/plugin.js?raw';
import leMemoriaSource from '@/plugins/examples/le-memoria/plugin.js?raw';
import guardaPreferenciasSource from '@/plugins/examples/guarda-preferencias/plugin.js?raw';
import olaFicheiroSource from '@/plugins/examples/ola-ficheiro/plugin.js?raw';
import olaNotificacaoSource from '@/plugins/examples/ola-notificacao/plugin.js?raw';
import olaRedeSource from '@/plugins/examples/ola-rede/plugin.js?raw';
import registaAtalhoSource from '@/plugins/examples/regista-atalho/plugin.js?raw';
import registaComandoSource from '@/plugins/examples/regista-comando/plugin.js?raw';
import registaDefinicaoSource from '@/plugins/examples/regista-definicao/plugin.js?raw';

/**
 * Que plugins têm código a sério para correr na sandbox, e o botão que o
 * dispara.
 *
 * A maioria do catálogo (`plugin-catalog.ts`) continua só interface — instalar
 * regista a escolha e mais nada. Um plugin entra aqui quando tiver código
 * isolado real por trás, capacidade a capacidade.
 *
 * Plugins instalados de ficheiro também se registam aqui dinamicamente via
 * `registerPluginRuntime()` — sem isso, o `PluginRuntime` não saberia que
 * código correr dentro do iframe.
 */
export interface RuntimeEntry {
  readonly source: string;
  readonly triggerLabel: string;
}

/** Registos dinâmicos de plugins instalados de ficheiro. */
const dynamicRuntimes = new Map<string, RuntimeEntry>();

const builtInRuntimes: Readonly<Record<string, RuntimeEntry>> = {
  'ola-notificacao': { source: olaNotificacaoSource, triggerLabel: 'Pedir notificação' },
  'ola-ficheiro': { source: olaFicheiroSource, triggerLabel: 'Escrever e ler um ficheiro' },
  'ola-rede': { source: olaRedeSource, triggerLabel: 'Pedir à rede' },
  'dispara-automacao': { source: disparaAutomacaoSource, triggerLabel: 'Disparar automação' },
  'abre-janela': { source: abreJanelaSource, triggerLabel: 'Abrir janela de Tarefas' },
  'regista-comando': { source: registaComandoSource, triggerLabel: 'Registar comando na paleta' },
  'escuta-eventos': { source: escutaEventosSource, triggerLabel: 'Subscrever evento de tema' },
  'guarda-preferencias': { source: guardaPreferenciasSource, triggerLabel: 'Contar visita' },
  'regista-atalho': { source: registaAtalhoSource, triggerLabel: 'Registar Ctrl+Shift+H' },
  'cria-widget': { source: criaWidgetSource, triggerLabel: 'Criar widget' },
  'adiciona-menu': { source: adicionaMenuSource, triggerLabel: 'Adicionar item ao menu' },
  'regista-definicao': { source: registaDefinicaoSource, triggerLabel: 'Registar definição' },
  'cria-servico': { source: criaServicoSource, triggerLabel: 'Registar serviço' },
  'adiciona-painel': { source: adicionaPainelSource, triggerLabel: 'Adicionar painel' },
  'executa-voz': { source: executaVozSource, triggerLabel: 'Falar' },
  'le-memoria': { source: leMemoriaSource, triggerLabel: 'Ler memória' },
};

/**
 * Runtime visível para um dado id de plugin.
 *
 * Procura primeiro nos registos dinâmicos (plugins de ficheiro), e depois nos
 * built-in (plugins de exemplo do catálogo). Devolve `undefined` se não houver
 * runtime registado para este id.
 */
export function getPluginRuntime(id: string): RuntimeEntry | undefined {
  return dynamicRuntimes.get(id) ?? builtInRuntimes[id];
}

/**
 * Todos os ids com runtime — built-in e dinâmicos.
 * O `PluginCard` usa isto para decidir se mostra o `<PluginRuntime>`.
 */
export const PLUGIN_RUNTIMES: Readonly<Record<string, RuntimeEntry>> = new Proxy<
  Readonly<Record<string, RuntimeEntry>>
>(builtInRuntimes, {
  get(target, prop) {
    if (typeof prop === 'string' && dynamicRuntimes.has(prop)) {
      return dynamicRuntimes.get(prop);
    }
    return target[prop as keyof typeof target];
  },
  ownKeys() {
    return [...Object.keys(builtInRuntimes), ...dynamicRuntimes.keys()];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === 'string' && dynamicRuntimes.has(prop)) {
      return { configurable: true, enumerable: true, value: dynamicRuntimes.get(prop) };
    }
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
});

/**
 * Regista um runtime para um plugin instalado de ficheiro.
 *
 * Sobrescreve qualquer registo anterior com o mesmo id — idempotente.
 * O `PluginRuntime` usa isto para saber que código correr.
 */
export function registerPluginRuntime(id: string, entry: RuntimeEntry): void {
  dynamicRuntimes.set(id, entry);
}

/**
 * Remove um runtime registado dinamicamente.
 *
 * Só remove entradas dinâmicas — os built-in são imutáveis.
 */
export function unregisterPluginRuntime(id: string): void {
  dynamicRuntimes.delete(id);
}

/**
 * Esvazia todos os registos dinâmicos — para testes.
 */
export function clearDynamicRuntimes(): void {
  dynamicRuntimes.clear();
}
