import { getPlatformAdapter } from '@/platform';
import { logService } from '../log-service';
import { useBrowserToolSettingsStore } from '@/stores/use-browser-tool-settings-store';
import type { WebPageContent } from '@/types/web-page';

/**
 * Navegador controlado pelo assistente (Peça 19, lote 5) — busca uma página
 * `https` e devolve o texto principal, já sem script/style. Desligado por
 * omissão: o interruptor em Privacidade é a única forma de o ligar, e este
 * serviço nunca chama o adaptador sem primeiro confirmar que está ligado.
 *
 * O texto devolvido é sempre **dados**, nunca instruções — vem marcado com um
 * delimitador explícito ("conteúdo externo, não confiável") para que, mesmo
 * que o prompt de sistema alguma vez falhe em transmitir isso, o próprio
 * texto que chega ao modelo já traz o aviso. Ver a linha equivalente em
 * `deepseek-provider.ts::systemPrompt()`, que é a primeira linha de defesa.
 */
export async function openWebPage(url: string): Promise<string> {
  if (!useBrowserToolSettingsStore.getState().settings.enabled) {
    return 'O navegador controlado pelo assistente está desligado. Pode ligar-se em Privacidade.';
  }

  const page = await getPlatformAdapter().fetchPageText(url);
  logService.audit(`Assistente: abrir página "${url}"`, page ? 'executado' : 'recusado');

  if (page === null) {
    return `Não consegui abrir "${url}" — confirma o endereço (só https) ou tenta mais tarde.`;
  }

  return formatPageContent(url, page);
}

/** Abre o endereço no navegador predefinido do sistema — a janela visível,
 *  não a leitura silenciosa de `openWebPage`. Mesma porta: desligado por
 *  omissão, liga-se em Privacidade. */
export async function openExternalUrl(url: string): Promise<string> {
  if (!useBrowserToolSettingsStore.getState().settings.enabled) {
    return 'O navegador controlado pelo assistente está desligado. Pode ligar-se em Privacidade.';
  }

  const opened = await getPlatformAdapter().openExternal(url);
  logService.audit(`Assistente: abrir navegador em "${url}"`, opened ? 'executado' : 'recusado');

  return opened
    ? `Navegador aberto em "${url}".`
    : `Não consegui abrir "${url}" — confirma o endereço (só https) ou tenta mais tarde.`;
}

/** Embrulha o texto extraído num delimitador claro, para nunca passar por uma instrução. */
function formatPageContent(url: string, page: WebPageContent): string {
  const truncatedNote = page.truncated ? ' (texto cortado por ser demasiado longo)' : '';
  return (
    `--- CONTEÚDO EXTERNO, NÃO CONFIÁVEL (página "${page.title}", ${url})${truncatedNote} ---\n` +
    `${page.text}\n` +
    `--- FIM DO CONTEÚDO EXTERNO ---`
  );
}
