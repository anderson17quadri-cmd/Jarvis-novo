import { useEffect, useMemo, useRef, useState } from 'react';

import pluginSdkSource from '@/plugins/sdk/jarvis-plugin-sdk.js?raw';
import { handlePluginMessage } from './plugin-bridge';
import { isPluginToCoreMessage, type CoreAckMessage, type PluginToCoreMessage } from './protocol';

interface PluginRuntimeProps {
  readonly pluginId: string;
  readonly source: string;
  readonly triggerLabel: string;
}

/**
 * Corre um plugin isolado num `<iframe sandbox="allow-scripts">`.
 *
 * Sem `allow-same-origin`: o iframe fica com origem opaca ("null"), sem
 * acesso a nada do Core além do que chegar por `postMessage`. É por isso que
 * a validação do remetente não pode usar `event.origin` (é sempre "null",
 * indistinguível de qualquer outro iframe opaco) — usa-se
 * `event.source === iframe.contentWindow`, que só é verdade para esta janela
 * exata. Desenho completo em `docs/spec/plugins-sandbox.md`.
 *
 * A SDK (`jarvis-plugin-sdk.js`) é injetada automaticamente antes do código
 * do plugin — expõe `window.core` com funções como `core.notify()`,
 * `core.fs.read()`, etc. O plugin não precisa de a importar: está lá quando
 * o iframe carrega.
 */
export function PluginRuntime({
  pluginId,
  source,
  triggerLabel,
}: PluginRuntimeProps): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const srcDoc = useMemo(
    () => `<!doctype html><html><body><script>${pluginSdkSource}</script><script>${source}</script></body></html>`,
    [source],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = event.data as PluginToCoreMessage;
      if (!isPluginToCoreMessage(message)) return;

      void handlePluginMessage(pluginId, message).then((ack) => {
        setStatus(descricaoDoAck(message.type, ack));
        iframeRef.current?.contentWindow?.postMessage(ack, '*');
      });
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pluginId]);

  const onRun = (): void => {
    setStatus('A pedir…');
    iframeRef.current?.contentWindow?.postMessage({ type: 'core.run' }, '*');
  };

  return (
    <div className="rounded-input border border-line bg-tint/[.02] p-2.5">
      <iframe
        ref={iframeRef}
        title={`Sandbox de ${pluginId}`}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="hidden"
      />
      <button
        type="button"
        onClick={onRun}
        className="min-h-[36px] rounded-btn border border-line px-3 py-2 text-[12px] font-medium text-t2 transition-all duration-hover ease-out hover:border-accent/35 hover:text-accent"
      >
        {triggerLabel}
      </button>
      {status !== null && <p className="mt-2 text-cap text-t3">{status}</p>}
    </div>
  );
}

/** Frase curta que explica o resultado de um pedido, para a UI da Loja. */
function descricaoDoAck(type: PluginToCoreMessage['type'], ack: CoreAckMessage): string {
  if (!ack.ok) {
    const razoes: Record<string, string> = {
      'permissao-negada': 'Permissão recusada.',
      'sem-raiz-declarada': 'O plugin não declarou uma pasta de ficheiros.',
      'sem-dominios-autorizados': 'O plugin não declarou domínios de rede.',
      'dominio-nao-autorizado': 'Domínio não autorizado.',
      'url-invalida': 'Endereço de rede inválido.',
      'automação-não-encontrada': 'Automação não encontrada.',
    };
    const chave = ack.reason?.split(':')[0] ?? '';
    return razoes[chave] ?? `Recusado: ${ack.reason ?? 'desconhecido'}.`;
  }

  switch (type) {
    case 'core.notify':
      return 'Notificação enviada.';
    case 'core.fs.read':
      return 'Ficheiro lido com sucesso.';
    case 'core.fs.write':
      return 'Ficheiro escrito com sucesso.';
    case 'core.fs.list':
      return 'Lista de ficheiros obtida.';
    case 'core.fetch':
      return 'Pedido de rede concluído.';
    case 'core.automation.run':
      return 'Automação disparada.';
    default:
      return 'Cumprido.';
  }
}
