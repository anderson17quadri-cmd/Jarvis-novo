import { useMemo, useState, useSyncExternalStore } from 'react';
import { Info, ShieldCheck, ShieldOff } from 'lucide-react';

import { PERMISSION_LABELS, PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { IDLE_LOCK_OPTIONS, idleLockLabel } from '@/types/appearance';
import { formatTime } from '@/lib/format';
import { logService } from '@/services/log-service';
import { usePluginStore } from '@/stores/use-plugin-store';
import { CAPABILITY_PRIVACY } from '@/types/privacy';
import type { PluginPermissions } from '@/plugins/plugin';

type Tab = 'permissoes' | 'auditoria' | 'acesso';

/**
 * Privacidade e permissões (Parte 14).
 *
 * Três coisas, todas verdadeiras:
 *
 * 1. **Permissões** — o que cada plugin instalado pediria, com a possibilidade
 *    de recusar. Nenhum plugin executa ainda, e o painel diz isso em vez de
 *    deixar acreditar que está a proteger de alguma coisa.
 * 2. **Auditoria** — o que o sistema fez, de onde veio e como correu. Isto é
 *    real: cada comando de voz, automação e instalação passa por aqui.
 * 3. **Acesso** — o que esta plataforma consegue mesmo alcançar. É a
 *    informação mais honesta de todas sobre privacidade: no browser, quase
 *    nada.
 */
export default function PrivacyWindow(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('permissoes');

  const entries = useSyncExternalStore(
    (onChange) => logService.subscribe(onChange),
    () => logService.list,
  );

  const audit = useMemo(
    () => entries.filter((entry) => entry.source === 'auditoria'),
    [entries],
  );

  return (
    <div className="flex h-full flex-col gap-s2">
      <div role="tablist" aria-label="Vista" className="flex flex-shrink-0 flex-wrap gap-1">
        <TabButton isActive={tab === 'permissoes'} onClick={() => setTab('permissoes')}>
          Permissões
        </TabButton>
        <TabButton isActive={tab === 'auditoria'} onClick={() => setTab('auditoria')}>
          Auditoria ({audit.length})
        </TabButton>
        <TabButton isActive={tab === 'acesso'} onClick={() => setTab('acesso')}>
          Acesso
        </TabButton>
      </div>

      {tab === 'permissoes' && <Permissions />}
      {tab === 'auditoria' && <Audit entries={audit} />}
      {tab === 'acesso' && <Access />}
    </div>
  );
}

function Permissions(): React.JSX.Element {
  const installed = usePluginStore((state) => state.installed);
  const denied = usePluginStore((state) => state.deniedPermissions);
  const setPermission = usePluginStore((state) => state.setPermission);
  const persist = usePluginStore((state) => state.persist);

  const plugins = PLUGIN_CATALOG.filter((entry) => installed[entry.id]);

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
      <p className="flex items-start gap-2 rounded-input border border-line bg-tint/[.02] p-2.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Nenhum plugin executa ainda, por isso recusar aqui não impede nada hoje — guarda a
          decisão para quando o carregamento real existir.
        </span>
      </p>

      {plugins.map((plugin) => {
        const Icon = plugin.icon;
        const asked = (Object.keys(PERMISSION_LABELS) as (keyof PluginPermissions)[]).filter(
          (key) => plugin.permissions[key],
        );

        return (
          <section
            key={plugin.id}
            aria-label={plugin.name}
            className="rounded-input border border-line bg-tint/[.02] p-3"
          >
            <p className="flex items-center gap-2 text-[13px] font-medium">
              <Icon className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
              {plugin.name}
            </p>

            {asked.length === 0 ? (
              <p className="mt-1.5 text-cap text-t3">Não pede permissão nenhuma.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {asked.map((key) => {
                  const isDenied = denied[plugin.id]?.includes(key) ?? false;

                  return (
                    <li key={key} className="flex items-center gap-2">
                      <span className="flex-1 text-[11.5px] text-t2">
                        {PERMISSION_LABELS[key]}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!isDenied}
                        aria-label={`${PERMISSION_LABELS[key]} para ${plugin.name}`}
                        onClick={() => {
                          setPermission(plugin.id, key, isDenied);
                          void persist();
                        }}
                        className={cn(
                          'flex min-h-[30px] items-center gap-1.5 rounded-btn border px-2.5 py-1',
                          'text-[11px] transition-all duration-hover ease-out',
                          isDenied
                            ? 'border-line text-t3 hover:border-danger/40'
                            : 'border-ok/45 bg-ok/[.08] text-ok',
                        )}
                      >
                        {isDenied ? (
                          <ShieldOff className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        )}
                        {isDenied ? 'Recusada' : 'Permitida'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {plugins.length === 0 && (
        <p className="py-s3 text-center text-desc text-t3">Nenhum plugin instalado.</p>
      )}
    </div>
  );
}

function Audit({
  entries,
}: {
  readonly entries: readonly { id: string; at: number; message: string; detail: string | null }[];
}): React.JSX.Element {
  return (
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline gap-2 rounded-input border border-line bg-tint/[.02] px-2.5 py-2"
        >
          <span className="mono flex-shrink-0 text-[10.5px] text-t3">
            {formatTime(new Date(entry.at))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px]">{entry.message}</span>
            {entry.detail && (
              <span className="block truncate text-[10.5px] text-t3">{entry.detail}</span>
            )}
          </span>
        </li>
      ))}

      {entries.length === 0 && (
        <li className="py-s3 text-center text-desc text-t3">
          Nada a registar. As ações do sistema aparecem aqui à medida que acontecem.
        </li>
      )}
    </ul>
  );
}

function Access(): React.JSX.Element {
  const capabilities = useCapabilities();

  return (
    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
      <SessionLock />

      <p className="flex items-start gap-2 rounded-input border border-line bg-tint/[.02] p-2.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          O que este dispositivo deixa o JARVIS alcançar. O que estiver recusado está-o pela
          plataforma, não por uma escolha — e não há forma de o contornar.
        </span>
      </p>

      {CAPABILITY_PRIVACY.map((item) => {
        const granted = capabilities[item.capability];

        return (
          <div
            key={item.capability}
            className="flex items-start gap-2.5 rounded-input border border-line bg-tint/[.02] p-2.5"
          >
            <span
              className={cn('mt-0.5 flex-shrink-0', granted ? 'text-ok' : 'text-t3')}
              aria-hidden="true"
            >
              {granted ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px]">{item.label}</span>
              <span className="block text-[10.5px] leading-[1.45] text-t3">
                {granted ? item.whenGranted : item.whenDenied}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bloqueio por inatividade (Parte 14 §Autenticação).
 *
 * Vive na Privacidade e não na Personalização porque não é uma preferência de
 * gosto: é a diferença entre uma sessão que se fecha sozinha e uma que fica
 * aberta a quem passar.
 */
function SessionLock(): React.JSX.Element {
  const minutes = useAppearanceStore((state) => state.appearance.idleLockMinutes);
  const set = useAppearanceStore((state) => state.set);
  const persist = useAppearanceStore((state) => state.persist);

  return (
    <section className="rounded-input border border-line bg-tint/[.02] p-2.5">
      <p className="t-label mb-1.5">Bloquear a sessão</p>
      <p className="mb-2 text-cap leading-relaxed text-t3">
        {minutes === 0
          ? 'Desligado: a sessão fica aberta até se terminar à mão.'
          : `Sem atividade durante ${idleLockLabel(minutes).toLowerCase()}, volta ao ecrã de bloqueio.`}
      </p>

      <div role="radiogroup" aria-label="Bloquear por inatividade" className="flex flex-wrap gap-1">
        {IDLE_LOCK_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === minutes}
            onClick={() => {
              set('idleLockMinutes', option);
              void persist();
            }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10.5px] transition-all duration-hover ease-out',
              option === minutes
                ? 'border-accent bg-accent/[.1] text-accent'
                : 'border-line text-t3 hover:border-accent/35 hover:text-t2',
            )}
          >
            {idleLockLabel(option)}
          </button>
        ))}
      </div>
    </section>
  );
}

function TabButton({
  isActive,
  onClick,
  children,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'rounded-input border px-3 py-2 text-[12.5px] font-medium transition-all duration-hover ease-out',
        isActive
          ? 'border-accent bg-accent/[.08] text-accent'
          : 'border-line text-t2 hover:border-accent/35 hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}
