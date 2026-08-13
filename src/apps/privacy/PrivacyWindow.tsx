import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Eye, EyeOff, Info, KeyRound, MousePointer, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';

import { PERMISSION_LABELS, PLUGIN_CATALOG } from '@/apps/plugin-manager/plugin-catalog';
import { BackupPanel } from './BackupPanel';
import { useCapabilities } from '@/hooks/use-platform';
import { cn } from '@/lib/cn';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { IDLE_LOCK_OPTIONS, idleLockLabel } from '@/types/appearance';
import { formatTime } from '@/lib/format';
import { logService } from '@/services/log-service';
import { directControlService, RISK_LABELS } from '@/services/direct-control-service';
import {
  getRegisteredSecurityKey,
  isWebAuthnSupported,
  registerSecurityKey,
  removeSecurityKey,
  type StoredCredential,
} from '@/services/webauthn-service';
import { usePluginStore } from '@/stores/use-plugin-store';
import { CAPABILITY_PRIVACY } from '@/types/privacy';
import { USER_NAME } from '@/constants/user';
import type { PluginPermissions } from '@/plugins/plugin';

type Tab = 'permissoes' | 'auditoria' | 'acesso' | 'copias' | 'controlo';

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
 * 4. **Cópias** — descarregar tudo o que está guardado, e voltar a pôr. Sem
 *    isto, limpar os dados do browser apagava o sistema inteiro.
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
        <TabButton isActive={tab === 'copias'} onClick={() => setTab('copias')}>
          Cópias
        </TabButton>
        <TabButton isActive={tab === 'controlo'} onClick={() => setTab('controlo')}>
          Controlo
        </TabButton>
      </div>

      {tab === 'permissoes' && <Permissions />}
      {tab === 'auditoria' && <Audit entries={audit} />}
      {tab === 'acesso' && <Access />}
      {tab === 'copias' && <BackupPanel />}
      {tab === 'controlo' && <ControlPanel />}
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
          Para a maioria dos plugins recusar aqui só guarda a decisão para quando a execução
          existir. Para os que já correm código a sério (os plugins de exemplo "Olá, …" e
          "Dispara automação", para já) recusar impede mesmo o pedido — testável na Loja de
          plugins.
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
      <SecurityKeySection />

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

/**
 * Chave física / autenticador — segundo fator ao lado do Windows Hello
 * (Parte 14 §Cofre de segredos, WebAuthn). Vive aqui, não no ecrã de login:
 * registar uma credencial nova é uma ação deliberada, não algo para se
 * pedir a quem ainda nem entrou.
 */
function SecurityKeySection(): React.JSX.Element {
  const supported = useMemo(() => isWebAuthnSupported(), []);
  const [credential, setCredential] = useState<StoredCredential | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    void getRegisteredSecurityKey().then(setCredential);
  }, []);

  const handleRegister = useCallback(() => {
    setBusy(true);
    setMessage(null);
    void registerSecurityKey(USER_NAME)
      .then(async (result) => {
        if (result.ok) {
          setCredential(await getRegisteredSecurityKey());
          setMessage({ text: 'Chave física registada.', isError: false });
        } else {
          setMessage({ text: result.reason, isError: true });
        }
      })
      .finally(() => setBusy(false));
  }, []);

  const handleRemove = useCallback(() => {
    setBusy(true);
    void removeSecurityKey()
      .then(() => {
        setCredential(null);
        setMessage({ text: 'Chave física removida.', isError: false });
      })
      .finally(() => setBusy(false));
  }, []);

  return (
    <section className="rounded-input border border-line bg-tint/[.02] p-2.5">
      <p className="t-label mb-1.5">Chave física (WebAuthn)</p>

      {!supported ? (
        <p className="text-cap leading-relaxed text-t3">
          Este dispositivo não suporta chaves de segurança — a API WebAuthn não está disponível.
        </p>
      ) : credential ? (
        <>
          <p className="mb-2 text-cap leading-relaxed text-t3">
            Registada em {formatTime(new Date(credential.registeredAt))}. Usa-a no ecrã de login
            ao lado do Windows Hello e do PIN.
          </p>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isBusy}
            className={cn(
              'flex items-center gap-1.5 rounded-btn border border-line px-3 py-2 text-[12px] font-medium text-t2',
              'transition-all duration-hover ease-out hover:border-danger/40 hover:text-danger',
              isBusy && 'opacity-60',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remover chave
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-cap leading-relaxed text-t3">
            Nenhuma chave registada. Um autenticador de plataforma ou uma chave física (ex.:
            YubiKey) pode servir de segundo fator ao lado da palavra-passe.
          </p>
          <button
            type="button"
            onClick={handleRegister}
            disabled={isBusy}
            className={cn(
              'flex items-center gap-1.5 rounded-btn border border-accent/50 bg-accent/[.1] px-3 py-2',
              'text-[12px] font-medium text-accent transition-all duration-hover ease-out hover:shadow-glow',
              isBusy && 'opacity-60',
            )}
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {isBusy ? 'A aguardar o autenticador…' : 'Registar chave física'}
          </button>
        </>
      )}

      {message && (
        <p className={cn('mt-2 text-cap', message.isError ? 'text-danger' : 'text-ok')}>
          {message.text}
        </p>
      )}
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

// ── Controlo direto (Fase 3.1) ────────────────────────────────────────────

function ControlPanel(): React.JSX.Element {
  const isEnabled = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.isEnabled,
  );
  const hasPassword = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.hasPassword,
  );
  const isSimulated = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.isSimulated,
  );
  const history = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.history,
  );

  const [phrase, setPhrase] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);

  const handleSetPassword = useCallback(() => {
    const trimmed = phrase.trim();
    if (trimmed.length < 4) return;
    void directControlService.setPassword(trimmed);
    setPhrase('');
    setShowPhrase(false);
  }, [phrase]);

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
      <p className="flex items-start gap-2 rounded-input border border-line bg-tint/[.02] p-2.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          O controlo direto deixa o JARVIS mexer no rato e no teclado como uma pessoa.
          Começa <strong>sempre desligado</strong>. Nenhuma ação acontece sem confirmação
          explícita. Desenho completo em{' '}
          <code className="text-[10px]">docs/spec/fase-3-controlo-direto.md</code>.
        </span>
      </p>

      {/* Ativação — item 20 */}
      <section className="rounded-input border border-line bg-tint/[.02] p-3">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          <MousePointer className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
          Controlo direto
        </p>
        <p className="mt-1 text-cap text-t3">
          Quando ligado, as ações de controlo direto ficam disponíveis — mas cada uma pede
          confirmação antes de executar.
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label="Ligar controlo direto"
            onClick={() => directControlService.setEnabled(!isEnabled)}
            className={cn(
              'flex items-center gap-1.5 rounded-btn border px-3 py-2 text-[12px] font-medium transition-all duration-hover',
              isEnabled
                ? 'border-accent/50 bg-accent/[.1] text-accent'
                : 'border-line text-t2 hover:border-accent/35',
            )}
          >
            {isEnabled ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isEnabled ? 'Ligado' : 'Desligado'}
          </button>
        </div>
      </section>

      {/* Palavra-passe — parte do item 20 */}
      <section className="rounded-input border border-line bg-tint/[.02] p-3">
        <p className="t-label mb-1.5">Palavra-passe de sessão</p>
        <p className="mb-2 text-cap text-t3">
          {hasPassword
            ? 'Palavra-passe guardada (hash, nunca em texto simples). Diz a frase em voz alta para abrir uma sessão de controlo direto.'
            : 'Define uma frase que só tu sabes. Dita por voz, abre uma sessão de controlo direto de 30 minutos. Guardada como hash — nunca visível depois de escrita.'}
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetPassword(); }}
              type={showPhrase ? 'text' : 'password'}
              placeholder={hasPassword ? 'Substituir palavra-passe' : 'Frase secreta…'}
              aria-label="Palavra-passe de controlo direto"
              className="w-full rounded-input border border-line bg-tint/[.03] py-2 pl-2.5 pr-8 text-[12.5px] text-t1 outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
            />
            <button
              type="button"
              onClick={() => setShowPhrase(!showPhrase)}
              aria-label={showPhrase ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-t3 transition-colors duration-hover hover:text-t1"
            >
              {showPhrase ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSetPassword}
            disabled={phrase.trim().length < 4}
            className={cn(
              'rounded-btn border px-3 py-2 text-[12px] font-medium transition-all duration-hover',
              phrase.trim().length >= 4
                ? 'border-accent/50 bg-accent/[.1] text-accent hover:shadow-glow'
                : 'border-line bg-tint/[.03] text-t3',
            )}
          >
            Guardar
          </button>
        </div>
      </section>

      {/* Modo simulado — item 23 */}
      <section className="rounded-input border border-line bg-tint/[.02] p-3">
        <p className="t-label mb-1.5">Modo simulado</p>
        <p className="mb-2 text-cap text-t3">
          Com o modo simulado ligado, as ações de controlo direto aparecem no overlay de
          confirmação mas <strong>nunca executam a sério</strong> — é para testar o fluxo sem
          risco.
        </p>

        <button
          type="button"
          role="switch"
          aria-checked={isSimulated}
          aria-label="Modo simulado"
          onClick={() => directControlService.setSimulated(!isSimulated)}
          className={cn(
            'flex items-center gap-1.5 rounded-btn border px-3 py-2 text-[12px] font-medium transition-all duration-hover',
            isSimulated
              ? 'border-[#F6A623]/40 bg-[#F6A623]/[.08] text-[#F6A623]'
              : 'border-line text-t2 hover:border-accent/35',
          )}
        >
          {isSimulated ? (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <MousePointer className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isSimulated ? 'Simulado (não executa)' : 'Real (executa a sério)'}
        </button>
      </section>

      {/* Histórico — item 22 */}
      <section className="rounded-input border border-line bg-tint/[.02] p-3">
        <div className="flex items-center justify-between">
          <p className="t-label">Passos de controlo direto</p>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => directControlService.clearHistory()}
              className="text-[11px] text-t3 transition-colors duration-hover hover:text-danger"
            >
              Limpar
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="mt-2 text-cap text-t3">Nenhum passo registado.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {history.map((step) => (
              <li
                key={step.id}
                className="flex items-baseline gap-2 rounded-input border border-line bg-tint/[.03] px-2.5 py-2"
              >
                <span className="mono flex-shrink-0 text-[10.5px] text-t3">
                  {formatTime(new Date(step.at))}
                </span>
                <span className="min-w-0 flex-1 text-[12px]">{step.description}</span>
                <span
                  className={cn(
                    'flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em]',
                    step.wasSimulated ? 'border-[#F6A623]/30 text-[#F6A623]' : 'border-danger/30 text-danger',
                  )}
                >
                  {step.wasSimulated ? 'Sim' : RISK_LABELS[step.risk]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
