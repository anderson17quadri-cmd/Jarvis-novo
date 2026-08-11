import abreJanelaSource from '@/plugins/examples/abre-janela/plugin.js?raw';
import disparaAutomacaoSource from '@/plugins/examples/dispara-automacao/plugin.js?raw';
import escutaEventosSource from '@/plugins/examples/escuta-eventos/plugin.js?raw';
import guardaPreferenciasSource from '@/plugins/examples/guarda-preferencias/plugin.js?raw';
import olaFicheiroSource from '@/plugins/examples/ola-ficheiro/plugin.js?raw';
import olaNotificacaoSource from '@/plugins/examples/ola-notificacao/plugin.js?raw';
import olaRedeSource from '@/plugins/examples/ola-rede/plugin.js?raw';
import registaAtalhoSource from '@/plugins/examples/regista-atalho/plugin.js?raw';
import registaComandoSource from '@/plugins/examples/regista-comando/plugin.js?raw';

/**
 * Que plugins têm código a sério para correr na sandbox, e o botão que o
 * dispara.
 *
 * A maioria do catálogo (`plugin-catalog.ts`) continua só interface — instalar
 * regista a escolha e mais nada. Um plugin entra aqui quando tiver código
 * isolado real por trás, capacidade a capacidade.
 */
export interface RuntimeEntry {
  readonly source: string;
  readonly triggerLabel: string;
}

export const PLUGIN_RUNTIMES: Readonly<Record<string, RuntimeEntry>> = {
  'ola-notificacao': { source: olaNotificacaoSource, triggerLabel: 'Pedir notificação' },
  'ola-ficheiro': { source: olaFicheiroSource, triggerLabel: 'Escrever e ler um ficheiro' },
  'ola-rede': { source: olaRedeSource, triggerLabel: 'Pedir à rede' },
  'dispara-automacao': { source: disparaAutomacaoSource, triggerLabel: 'Disparar automação' },
  'abre-janela': { source: abreJanelaSource, triggerLabel: 'Abrir janela de Tarefas' },
  'regista-comando': { source: registaComandoSource, triggerLabel: 'Registar comando na paleta' },
  'escuta-eventos': { source: escutaEventosSource, triggerLabel: 'Subscrever evento de tema' },
  'guarda-preferencias': { source: guardaPreferenciasSource, triggerLabel: 'Contar visita' },
  'regista-atalho': { source: registaAtalhoSource, triggerLabel: 'Registar Ctrl+Shift+H' },
};
