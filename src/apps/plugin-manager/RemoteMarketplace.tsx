import { useState } from 'react';
import { usePluginStore } from '@/stores/use-plugin-store';
import { loadExternalPlugin } from '@/plugins/external-storage';
import {
  applyMarketplacePackage, hasMarketplaceRollback, loadMarketplace, MARKETPLACE_SOURCE_KEY,
  prepareMarketplacePackage, rollbackMarketplacePlugin, type RemotePluginListing,
} from '@/plugins/marketplace';
import type { PluginPackage } from '@/plugins/plugin';

export function RemoteMarketplace({ onConnected }: { readonly onConnected: (connected: boolean) => void }): React.JSX.Element {
  const [source, setSource] = useState(() => localStorage.getItem(MARKETPLACE_SOURCE_KEY) ?? '');
  const [loadedSource, setLoadedSource] = useState('');
  const [listings, setListings] = useState<readonly RemotePluginListing[] | null>(null);
  const [pending, setPending] = useState<PluginPackage | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const installed = usePluginStore(state => state.installed);
  async function act(action: () => Promise<void>): Promise<void> {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
      ? 'Não consegui contactar a fonte GitHub. Confirma a ligação e o URL do índice.'
      : error instanceof Error ? error.message : 'A operação falhou.'); }
    finally { setBusy(false); }
  }
  async function load(): Promise<void> {
    const entries = await loadMarketplace(source.trim());
    localStorage.setItem(MARKETPLACE_SOURCE_KEY, source.trim());
    setLoadedSource(source.trim()); setListings(entries); setPending(null);
    onConnected(true);
  }
  async function prepare(listing: RemotePluginListing): Promise<void> {
    const pkg = await prepareMarketplacePackage(listing, loadedSource);
    setTrusted(false); setPending(pkg);
  }
  async function install(): Promise<void> {
    if (!pending || !trusted) return;
    await applyMarketplacePackage(pending);
    setPending(null);
    setMessage('Pacote guardado e assinatura verificada. Ativa-o na aba Instalados quando quiseres executar.');
  }
  return <section className="flex flex-col gap-2">
    <p className="text-cap text-t3">Fonte pública GitHub · pedidos apenas ao carregar ou descarregar · atualizações manuais</p>
    <label className="text-cap text-t3">URL do índice GitHub
      <input type="url" value={source} disabled={busy} onChange={event => setSource(event.target.value)}
        placeholder="https://raw.githubusercontent.com/autor/repo/main/index.json"
        className="w-full rounded-input border border-line bg-black/20 px-2 py-2 text-cap text-t1" />
    </label>
    <button type="button" disabled={busy || !source.trim()} onClick={() => void act(load)}
      className="self-start rounded border border-accent/40 px-3 py-2 text-cap text-accent disabled:opacity-40">
      {busy ? 'A processar…' : 'Carregar catálogo remoto'}
    </button>
    {message && <p role="status" className="break-words text-cap text-t2">{message}</p>}
    {pending && <div role="region" aria-label="Confirmar pacote remoto" className="space-y-2 rounded-input border border-warn/40 p-3 text-cap">
      <p>{pending.manifest.name} · versão {pending.manifest.version} · {pending.manifest.author}</p>
      <p>Permissões pedidas: {Object.entries(pending.manifest.permissions).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || 'nenhuma'}.</p>
      <p className="break-all text-t3">Chave pública do editor: {pending.signerPublicKey}</p>
      <p className="text-t3">A assinatura confirma este código e manifesto. Confirma a chave com o editor antes de lhe conceder acesso.</p>
      <label className="flex gap-2"><input type="checkbox" checked={trusted} disabled={busy} onChange={event => setTrusted(event.target.checked)} />Confio nesta chave e nas permissões indicadas</label>
      <div className="flex gap-3">
        <button type="button" disabled={busy || !trusted} onClick={() => void act(install)} className="text-accent disabled:opacity-40">Confirmar instalação</button>
        <button type="button" disabled={busy} onClick={() => setPending(null)} className="text-t3">Cancelar</button>
      </div>
    </div>}
    {listings && <ul className="space-y-2">{listings.map(listing => {
      const current = installed[listing.id] ? loadExternalPlugin(listing.id) : undefined;
      return <li key={listing.id} className="space-y-2 rounded-input border border-line p-3 text-cap">
        <p className="break-words text-t1">{listing.name} · {listing.version} · {listing.author}</p>
        {current && <p className="text-t3">Instalada: {current.manifest.version}{installed[listing.id]?.isEnabled ? '' : ' · desativada'}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || current?.manifest.version === listing.version} onClick={() => void act(() => prepare(listing))}
            className="text-accent disabled:opacity-40">{current ? `Substituir pela versão ${listing.version}` : 'Verificar pacote'}</button>
          {current && hasMarketplaceRollback(listing.id) && <button type="button" disabled={busy}
            onClick={() => { if (window.confirm('Recuperar a versão anterior deste plugin? Ficará desativada até a ativares.')) void act(async () => {
              await rollbackMarketplacePlugin(listing.id); setMessage('Versão anterior recuperada e desativada.');
            }); }} className="text-t3">Recuperar versão anterior</button>}
        </div>
      </li>;
    })}</ul>}
    {listings?.length === 0 && <p className="text-cap text-t3">O catálogo remoto está vazio.</p>}
  </section>;
}
