import { Check, Download, Power, ShieldAlert, ShieldCheck, ShieldOff, ShieldX, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { removeExternalPlugin } from '@/plugins/external-storage';
import { PluginRuntime } from '@/plugins/runtime/PluginRuntime';
import { PLUGIN_RUNTIMES, unregisterPluginRuntime } from '@/plugins/runtime/registry';
import { getSignatureStatus, type SignatureStatus } from '@/plugins/signature';
import { notificationService } from '@/services/notification-service';
import { usePluginStore, verifyAndInstallPlugin } from '@/stores/use-plugin-store';
import type { PlatformCapabilities } from '@/types/platform';
import { listPermissions, missingCapabilities, toManifest, type CatalogEntry } from './plugin-catalog';

/** Milhares com separador, à portuguesa. */
const INSTALL_FORMATTER = new Intl.NumberFormat('pt-PT');

interface PluginCardProps {
  readonly entry: CatalogEntry;
  readonly capabilities: PlatformCapabilities;
}

/**
 * Cartão de um plugin.
 *
 * Mostra sempre as permissões que o plugin pediria, mesmo sem as conceder a
 * ninguém: quem instala deve ver o que estaria a autorizar, e a lista tem de
 * estar visível *antes* do botão, não depois.
 */
export function PluginCard({ entry, capabilities }: PluginCardProps): React.JSX.Element {
  const state = usePluginStore((store) => store.installed[entry.id]);
  const uninstall = usePluginStore((store) => store.uninstall);
  const toggleEnabled = usePluginStore((store) => store.toggleEnabled);
  const persist = usePluginStore((store) => store.persist);

  const [sigStatus, setSigStatus] = useState<SignatureStatus>('sem-assinatura');
  const [isInstalling, setIsInstalling] = useState(false);

  const Icon = entry.icon;
  const runtime = PLUGIN_RUNTIMES[entry.id];
  const permissions = listPermissions(entry.permissions);
  const missing = missingCapabilities(entry, capabilities);
  const isAvailable = missing.length === 0;
  const isInstalled = state !== undefined;

  // Verifica a assinatura ao montar — assíncrono porque envolve SubtleCrypto.
  useEffect(() => {
    let cancelled = false;
    const manifest = toManifest(entry);
    const params: { manifest: typeof manifest; signature?: string; signerPublicKey?: string } = {
      manifest,
    };
    if (entry.signature) params.signature = entry.signature;
    if (entry.signerPublicKey) params.signerPublicKey = entry.signerPublicKey;
    void getSignatureStatus(params).then((status) => {
      if (!cancelled) setSigStatus(status);
    });
    return () => { cancelled = true; };
  }, [entry]);

  const onInstall = async (): Promise<void> => {
    setIsInstalling(true);
    const params: { id: string; signature?: string; signerPublicKey?: string } = {
      id: entry.id,
    };
    if (entry.signature) params.signature = entry.signature;
    if (entry.signerPublicKey) params.signerPublicKey = entry.signerPublicKey;
    const result = await verifyAndInstallPlugin(params);

    if (result.ok) {
      notificationService.success(
        `${entry.name} instalado`,
        entry.signature
          ? `Assinatura verificada: ${entry.signerName ?? 'signatário desconhecido'}.`
          : 'Plugin do catálogo local — sem assinatura.',
        { category: 'plugins' },
      );
    } else {
      notificationService.info(
        `${entry.name} recusado`,
        SIG_STATUS_LABEL[result.status] ?? 'Assinatura inválida.',
        { category: 'plugins' },
      );
    }
    setIsInstalling(false);
  };

  const onUninstall = (): void => {
    uninstall(entry.id);
    void persist();

    // Limpar o armazenamento de plugins externos (se for o caso).
    // Idempotente — se o plugin não for externo, não faz nada.
    removeExternalPlugin(entry.id);
    unregisterPluginRuntime(entry.id);

    notificationService.info(`${entry.name} removido`, 'Deixou de constar dos instalados.', {
      category: 'plugins',
    });
  };

  const onToggle = (): void => {
    toggleEnabled(entry.id);
    void persist();
  };

  return (
    <li
      className={cn(
        'rounded-input border border-line bg-tint/[.02] p-3 transition-colors duration-hover',
        !isAvailable && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input border border-line bg-accent/[.06] text-accent"
          aria-hidden="true"
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium">
            {entry.name}
            <span className="mono text-[10.5px] text-t3">v{entry.version}</span>
            {entry.isBuiltIn && (
              <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-t3">
                do sistema
              </span>
            )}
          </p>

          <p className="mt-0.5 text-cap text-t3">{entry.tagline}</p>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-t3">
            <span>{entry.author}</span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-accent" aria-hidden="true" />
              {entry.rating.toFixed(1)}
            </span>
            <span>{INSTALL_FORMATTER.format(entry.installs)} instalações</span>
          </p>

          {/* Assinatura: estado visível, não escondido — Parte 5, Lote 2. */}
          <SignatureBadge
            status={sigStatus}
            {...(entry.signerName ? { signerName: entry.signerName } : {})}
          />
        </div>
      </div>

      {permissions.length > 0 && (
        <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="sr-only">Permissões pedidas:</span>
          {permissions.map((label) => (
            <span
              key={label}
              className="rounded-full border border-line px-2 py-px text-[10px] text-t3"
            >
              {label}
            </span>
          ))}
        </p>
      )}

      {!isAvailable && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-warn">
          <ShieldAlert className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>Indisponível neste dispositivo: falta {missing.join(', ')}.</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!isInstalled && (
          <CardButton onClick={() => { void onInstall(); }} isDisabled={!isAvailable || isInstalling} isPrimary>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {isInstalling ? 'A verificar…' : 'Instalar'}
          </CardButton>
        )}

        {isInstalled && !entry.isBuiltIn && (
          <>
            <CardButton onClick={onToggle}>
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
              {state.isEnabled ? 'Desativar' : 'Ativar'}
            </CardButton>
            <CardButton onClick={onUninstall}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remover
            </CardButton>
          </>
        )}

        {isInstalled && entry.isBuiltIn && (
          <p className="flex items-center gap-1.5 text-[11.5px] text-t3">
            <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Faz parte do sistema
          </p>
        )}

        {isInstalled && !state.isEnabled && (
          <p className="flex items-center text-[11px] text-t3">Instalado, mas desativado.</p>
        )}
      </div>

      {isInstalled && state.isEnabled && runtime && (
        <div className="mt-3">
          <PluginRuntime pluginId={entry.id} source={runtime.source} triggerLabel={runtime.triggerLabel} />
        </div>
      )}
    </li>
  );
}

// ─── Indicador de assinatura ────────────────────────────────────────────────

const SIG_STATUS_LABEL: Record<SignatureStatus, string> = {
  'assinado-valido': 'Assinado e verificado',
  'sem-assinatura': 'Sem assinatura',
  'assinatura-invalida': 'Assinatura inválida',
  'chave-revogada': 'Chave revogada',
};

const SIG_STATUS_ICON: Record<SignatureStatus, React.JSX.Element> = {
  'assinado-valido': <ShieldCheck className="h-3 w-3 text-ok" aria-hidden="true" />,
  'sem-assinatura': <ShieldOff className="h-3 w-3 text-t3" aria-hidden="true" />,
  'assinatura-invalida': <ShieldX className="h-3 w-3 text-err" aria-hidden="true" />,
  'chave-revogada': <ShieldAlert className="h-3 w-3 text-warn" aria-hidden="true" />,
};

interface SignatureBadgeProps {
  readonly status: SignatureStatus;
  readonly signerName?: string;
}

function SignatureBadge({ status, signerName }: SignatureBadgeProps): React.JSX.Element {
  const label = SIG_STATUS_LABEL[status];
  const icon = SIG_STATUS_ICON[status];

  const textColor =
    status === 'assinado-valido'
      ? 'text-ok'
      : status === 'assinatura-invalida'
        ? 'text-err'
        : status === 'chave-revogada'
          ? 'text-warn'
          : 'text-t3';

  return (
    <p className={cn('mt-1 flex items-center gap-1 text-[10.5px]', textColor)}>
      {icon}
      <span>
        {label}
        {status === 'assinado-valido' && signerName && ` por ${signerName}`}
      </span>
    </p>
  );
}

// ─── Botão ──────────────────────────────────────────────────────────────────

interface CardButtonProps {
  readonly onClick: () => void;
  readonly isDisabled?: boolean;
  readonly isPrimary?: boolean;
  readonly children: React.ReactNode;
}

function CardButton({
  onClick,
  isDisabled = false,
  isPrimary = false,
  children,
}: CardButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        // 44px de alvo de toque, como manda a Parte 6.2 para ecrãs pequenos.
        'flex min-h-[36px] items-center gap-1.5 rounded-btn border px-3 py-2 text-[12px] font-medium',
        'transition-all duration-hover ease-out active:scale-[.98] compact:min-h-[44px]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        isPrimary
          ? 'border-accent/50 bg-accent/[.1] text-accent hover:enabled:bg-accent/[.16]'
          : 'border-line text-t2 hover:enabled:border-accent/35 hover:enabled:text-accent',
      )}
    >
      {children}
    </button>
  );
}
