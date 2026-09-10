import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import pluginSdkSource from '@/plugins/sdk/jarvis-plugin-sdk.js?raw';
import {
  clearPluginMenuItems,
  clearPluginPanels,
  clearPluginServices,
  clearPluginSettings,
  clearPluginShortcuts,
  clearPluginSubscriptions,
  clearPluginWidgets,
  getPluginPanels,
  getPluginSettingValue,
  getPluginSettings,
  getPluginWidgets,
  handlePluginMessage,
  registerPluginSender,
  setPluginSettingValue,
  unregisterPluginSender,
  type PluginPanel,
  type PluginSetting,
  type PluginWidget,
} from './plugin-bridge';
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
  const [widgets, setWidgets] = useState<readonly PluginWidget[]>([]);
  const [panels, setPanels] = useState<readonly PluginPanel[]>([]);
  const [settings, setSettings] = useState<readonly PluginSetting[]>([]);
  const [settingValues, setSettingValues] = useState<Readonly<Record<string, boolean | string>>>(
    {},
  );

  const srcDoc = useMemo(
    () => `<!doctype html><html><body><script>${pluginSdkSource}</script><script>${source}</script></body></html>`,
    [source],
  );

  /** Relê o que o plugin tem registado, depois de um pedido que pode ter mudado algo. */
  const refreshRegistrations = async (): Promise<void> => {
    setWidgets(getPluginWidgets(pluginId));
    setPanels(getPluginPanels(pluginId));
    const schema = getPluginSettings(pluginId);
    setSettings(schema);

    const values: Record<string, boolean | string> = {};
    for (const setting of schema) {
      values[setting.chave] = await getPluginSettingValue(
        pluginId,
        setting.chave,
        setting.valorOmissao,
      );
    }
    setSettingValues(values);
  };

  useEffect(() => {
    const sendToPlugin = (msg: Record<string, unknown>): void => {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    };
    registerPluginSender(pluginId, sendToPlugin);

    function onMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = event.data as PluginToCoreMessage;
      if (!isPluginToCoreMessage(message)) return;

      void handlePluginMessage(pluginId, message, sendToPlugin).then((ack) => {
        setStatus(descricaoDoAck(message.type, ack));
        iframeRef.current?.contentWindow?.postMessage(ack, '*');

        if (
          ack.ok &&
          (message.type === 'core.widget.create' ||
            message.type === 'core.panel.add' ||
            message.type === 'core.setting.register')
        ) {
          void refreshRegistrations();
        }
      });
    }

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      unregisterPluginSender(pluginId);
      clearPluginSubscriptions(pluginId);
      clearPluginShortcuts(pluginId);
      clearPluginWidgets(pluginId);
      clearPluginSettings(pluginId);
      clearPluginServices(pluginId);
      clearPluginPanels(pluginId);
      clearPluginMenuItems(pluginId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshRegistrations depende só de pluginId, redeclará-la de propósito
  }, [pluginId]);

  const onRun = (): void => {
    setStatus('A pedir…');
    iframeRef.current?.contentWindow?.postMessage({ type: 'core.run' }, '*');
  };

  const onSettingChange = (setting: PluginSetting, valor: boolean | string): void => {
    setSettingValues((prev) => ({ ...prev, [setting.chave]: valor }));
    void setPluginSettingValue(pluginId, setting.chave, valor);
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

      {widgets.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">Widgets</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {widgets.map((widget) => (
              <li
                key={widget.id}
                className="rounded-input border border-line bg-tint/[.03] px-2 py-1.5 text-[11px]"
              >
                <p className="font-medium text-t1">{widget.titulo}</p>
                <p className="text-t3">{widget.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settings.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">Definições</p>
          <ul className="mt-1 space-y-1.5">
            {settings.map((setting) => (
              <li key={setting.chave} className="flex items-center gap-2 text-[11.5px]">
                <span className="flex-1 text-t2">{setting.rotulo}</span>
                {setting.tipo === 'boolean' ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(settingValues[setting.chave])}
                    aria-label={setting.rotulo}
                    onClick={() => onSettingChange(setting, !settingValues[setting.chave])}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10.5px]',
                      settingValues[setting.chave]
                        ? 'border-ok/45 bg-ok/[.08] text-ok'
                        : 'border-line text-t3',
                    )}
                  >
                    {settingValues[setting.chave] ? 'Ligado' : 'Desligado'}
                  </button>
                ) : (
                  <input
                    type="text"
                    aria-label={setting.rotulo}
                    value={(settingValues[setting.chave] as string | undefined) ?? ''}
                    onChange={(event) => onSettingChange(setting, event.target.value)}
                    className="w-28 rounded-input border border-line bg-tint/[.03] px-1.5 py-1 text-[11px] outline-none focus:border-accent/45"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {panels.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">Painéis</p>
          {panels.map((panel) => (
            <PluginPanelBlock key={panel.id} panel={panel} />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginPanelBlock({ panel }: { readonly panel: PluginPanel }): React.JSX.Element {
  const [isOpen, setOpen] = useState(false);

  return (
    <div className="rounded-input border border-line bg-tint/[.03]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11.5px] font-medium text-t1"
      >
        {panel.titulo}
        <span className="text-t3">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <p className="border-t border-line px-2.5 py-1.5 text-[11px] text-t2">{panel.texto}</p>}
    </div>
  );
}

/** Frase curta que explica o resultado de um pedido, para a UI da Loja. */
function descricaoDoAck(type: PluginToCoreMessage['type'], ack: CoreAckMessage): string {
  if (!ack.ok) {
    const razoes: Record<string, string> = {
      'permissao-negada': 'Permissão recusada.',
      'permissao-nao-declarada': 'Esta capacidade não está declarada no manifesto do plugin.',
      'sem-raiz-declarada': 'O plugin não declarou uma pasta de ficheiros.',
      'sem-dominios-autorizados': 'O plugin não declarou domínios de rede.',
      'dominio-nao-autorizado': 'Domínio não autorizado.',
      'url-invalida': 'Endereço de rede inválido.',
      'automação-não-encontrada': 'Automação não encontrada.',
      'app-desconhecida': 'Aplicação desconhecida.',
      'app-por-implementar': 'Essa aplicação ainda não está implementada.',
      'comando-ja-registado': 'Este comando já foi registado.',
      'evento-desconhecido': 'Este evento não existe no sistema.',
      'atalho-ja-registado': 'Este atalho já foi registado.',
      'atalho-reservado': 'Este atalho pertence ao sistema.',
      'item-ja-registado': 'Este item de menu já foi registado.',
      'servico-ja-registado': 'Este serviço já foi registado.',
      'voz-indisponivel': 'A voz não está disponível neste dispositivo.',
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
    case 'core.window.open':
      return 'Janela aberta.';
    case 'core.command.register':
      return 'Comando registado na paleta.';
    case 'core.event.subscribe':
      return 'Subscrição de evento ativa.';
    case 'core.storage.set':
      return 'Preferência guardada.';
    case 'core.storage.get':
      return 'Preferência lida.';
    case 'core.storage.remove':
      return 'Preferência removida.';
    case 'core.shortcut.register':
      return 'Atalho registado.';
    case 'core.widget.create':
      return 'Widget criado.';
    case 'core.menu.add':
      return 'Item de menu adicionado.';
    case 'core.setting.register':
      return 'Definição registada.';
    case 'core.service.register':
      return 'Serviço a correr em segundo plano.';
    case 'core.panel.add':
      return 'Painel adicionado.';
    case 'core.voice.speak':
      return 'Voz executada.';
    case 'core.memory.read':
      return 'Memória lida.';
    default:
      return 'Cumprido.';
  }
}
