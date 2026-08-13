import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  Activity,
  Cpu,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Grid3x3,
  HardDrive,
  KeyRound,
  Languages,
  Lock,
  Monitor,
  Power,
  RotateCcw,
  ScanFace,
  Shield,
  Moon,
  Unlock,
  Wifi,
} from 'lucide-react';

import { useClock } from '@/hooks/use-clock';
import { useReducedMotion } from '@/hooks/use-media-query';
import { useTypewriter } from '@/hooks/use-typewriter';
import { cn } from '@/lib/cn';
import { formatLongDate, formatTime } from '@/lib/format';
import { getPlatformAdapter } from '@/platform';
import { createAutoLoginSession, hasValidAutoLoginSession } from '@/services/auto-login-service';
import { notificationService } from '@/services/notification-service';
import { soundService } from '@/services/sound-service';
import { hasRegisteredSecurityKey, verifySecurityKey } from '@/services/webauthn-service';
import { measurePasswordStrength } from './password-strength';
import { PinKeypad } from './PinKeypad';
import { USER_FIRST_NAME, USER_NAME } from '@/constants/user';

/** Frases que o assistente vai dizendo enquanto espera pela autenticação. */
const ASSISTANT_LINES = [
  `Bom dia, ${USER_FIRST_NAME}.`,
  'Todos os sistemas estão operacionais.',
  'Tem três compromissos hoje.',
  'Aguardo a sua autenticação.',
] as const;

const LINE_INTERVAL_MS = 3_400;
/** Tempo da leitura facial simulada. */
const FACE_SCAN_MS = 2_000;
/** Pausa entre confirmar a identidade e o desktop entrar. */
const GRANT_DELAY_MS = 620;

type HintTone = 'neutral' | 'ok' | 'error';
type AuthMethod = 'password' | 'pin';

interface LoginScreenProps {
  readonly onAuthenticated: (avatarElement: HTMLElement) => void;
}

/**
 * Ecrã de autenticação (Parte 5).
 *
 * A biometria tenta o Windows Hello a sério primeiro (`checkBiometric
 * Availability`/`requestBiometricVerification`, via `runRealOrSimulated
 * Biometrics`) e só cai para a simulação original em máquinas sem sensor
 * nem PIN configurado — nunca quebra quem não tem o hardware.
 *
 * A **chave física** (WebAuthn) é um segundo fator à parte, não uma
 * simulação: sem chave registada, diz isso sem rodeios; com chave, pede a
 * cerimónia a sério e verifica a assinatura antes de entrar
 * (`webauthn-service.ts`). Regista-se em Privacidade → Acesso, não aqui.
 */
export function LoginScreen({ onAuthenticated }: LoginScreenProps): React.JSX.Element {
  const now = useClock();
  const reducedMotion = useReducedMotion();

  const [method, setMethod] = useState<AuthMethod>('password');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isCapsLockOn, setCapsLockOn] = useState(false);
  const [hint, setHint] = useState<{ text: string; tone: HintTone }>({
    text: ASSISTANT_LINES[0],
    tone: 'neutral',
  });
  const [isScanningFace, setScanningFace] = useState(false);
  const [isShaking, setShaking] = useState(false);
  const [isLeaving, setLeaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isResolvedRef = useRef(false);

  const strength = measurePasswordStrength(password);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // As frases só rodam enquanto o campo está neutro: substituir uma mensagem de
  // erro por uma frase de conversa seria esconder informação ao utilizador.
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (isResolvedRef.current) return;
      index = (index + 1) % ASSISTANT_LINES.length;
      setHint((current) =>
        current.tone === 'neutral'
          ? { text: ASSISTANT_LINES[index] ?? current.text, tone: 'neutral' }
          : current,
      );
    }, LINE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  const grant = useCallback(
    (message: string): void => {
      if (isResolvedRef.current) return;
      isResolvedRef.current = true;

      soundService.play('success');
      setHint({ text: message, tone: 'ok' });
      timersRef.current.push(
        setTimeout(
          () => {
            setLeaving(true);
            timersRef.current.push(
              setTimeout(() => onAuthenticated(avatarRef.current!), reducedMotion ? 0 : GRANT_DELAY_MS),
            );
          },
          reducedMotion ? 0 : GRANT_DELAY_MS,
        ),
      );
    },
    [onAuthenticated, reducedMotion],
  );

  // Sessão automática (Parte 5 §Biometria): só entra sozinha se uma
  // verificação Windows Hello recente ainda for válida — nunca substitui a
  // palavra-passe nem o PIN, que continuam a exigir o formulário.
  useEffect(() => {
    void (async () => {
      const valid = await hasValidAutoLoginSession();
      if (valid && !isResolvedRef.current) grant('Sessão continuada — verificação recente ainda válida.');
    })();
    // `grant` nas deps por causa da regra, não porque isto deva repetir-se:
    // é assíncrono, e se a identidade mudar antes de a leitura do cofre
    // terminar, é correto usar a versão mais recente.
  }, [grant]);

  const deny = useCallback((message = 'Não foi possível verificar a identidade. Tente novamente.'): void => {
    soundService.play('error');
    setShaking(true);
    timersRef.current.push(setTimeout(() => setShaking(false), 440));
    setHint({ text: message, tone: 'error' });
    inputRef.current?.focus();
  }, []);

  const submit = useCallback((): void => {
    if (password.trim().length > 0) {
      grant('Identidade confirmada.');
    } else {
      deny();
    }
  }, [deny, grant, password]);

  /**
   * Tenta o Windows Hello a sério primeiro; só simula se esta máquina não
   * tiver sensor nem PIN configurado. `onSimulate` é o que cada botão fazia
   * antes de existir verificação real — fica como fallback, não como o
   * caminho principal.
   */
  const runRealOrSimulatedBiometrics = useCallback(
    (onSimulate: () => void): void => {
      void (async () => {
        const available = await getPlatformAdapter().checkBiometricAvailability();
        if (!available) {
          onSimulate();
          return;
        }

        soundService.play('scanner');
        setHint({ text: 'A aguardar o Windows Hello…', tone: 'neutral' });
        const outcome = await getPlatformAdapter().requestBiometricVerification(
          'O JARVIS pede a sua verificação para iniciar sessão.',
        );

        if (outcome === 'verified') {
          void createAutoLoginSession();
          grant('Identidade confirmada pelo Windows Hello.');
        } else {
          deny();
        }
      })();
    },
    [deny, grant],
  );

  const runFaceScan = useCallback((): void => {
    runRealOrSimulatedBiometrics(() => {
      setScanningFace(true);
      // A categoria "sistema" já se descrevia como "arranque e leitura
      // biométrica" (Parte 15 §Sons) sem nunca ter tocado nada — nem aqui, nem
      // no arranque.
      soundService.play('scanner');
      setHint({ text: 'A analisar biometria…', tone: 'neutral' });
      timersRef.current.push(
        setTimeout(
          () => {
            setScanningFace(false);
            grant('Acesso autorizado.');
          },
          reducedMotion ? 0 : FACE_SCAN_MS,
        ),
      );
    });
  }, [grant, reducedMotion, runRealOrSimulatedBiometrics]);

  const runFingerprintScan = useCallback((): void => {
    runRealOrSimulatedBiometrics(() => {
      if (reducedMotion) {
        grant('Identidade confirmada.');
        return;
      }

      soundService.play('scanner');
      let progress = 0;
      const timer = setInterval(() => {
        progress += 8 + Math.random() * 10;
        if (progress >= 100) {
          clearInterval(timer);
          grant('Identidade confirmada.');
        } else {
          setHint({ text: `A ler impressão digital… ${Math.round(progress)}%`, tone: 'neutral' });
        }
      }, 130);
    });
  }, [grant, reducedMotion, runRealOrSimulatedBiometrics]);

  /**
   * Chave física (WebAuthn) — segundo fator ao lado do Windows Hello e do PIN.
   * Sem chave registada, diz isso sem rodeios em vez de fingir que procurou
   * hardware nenhum. Com chave registada, pede a cerimónia a sério e só entra
   * depois de a assinatura verificar (ver `webauthn-service.ts`).
   */
  const runSecurityKey = useCallback((): void => {
    void (async () => {
      const registered = await hasRegisteredSecurityKey();
      if (!registered) {
        deny('Nenhuma chave física registada — regista uma em Privacidade → Acesso.');
        return;
      }

      soundService.play('scanner');
      setHint({ text: 'A aguardar a chave física…', tone: 'neutral' });
      const result = await verifySecurityKey();

      if (result.ok) {
        void createAutoLoginSession();
        grant('Identidade confirmada pela chave física.');
      } else {
        deny(result.reason);
      }
    })();
  }, [deny, grant]);

  /** CAPS LOCK só se sabe a partir de um evento de teclado, não do estado. */
  const trackCapsLock = useCallback((event: React.KeyboardEvent<HTMLInputElement>): void => {
    setCapsLockOn(event.getModifierState('CapsLock'));
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 z-login flex flex-col items-center justify-center gap-s3 overflow-y-auto p-s3',
        'transition-[opacity,visibility,transform] duration-[600ms] ease-io',
        isLeaving && 'invisible scale-[1.04] opacity-0',
      )}
    >
      <header className="text-center">
        <div className="pl-[0.38em] text-[26px] font-light tracking-[0.38em]">JARVIS</div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-t3">
          Artificial Intelligence Operating System
        </div>

        <div className="mt-s3 flex flex-wrap justify-center gap-s3">
          <MetaItem value={formatTime(now)} label="Hora" mono />
          <MetaItem value={formatLongDate(now)} label="Data" />
          <MetaItem value={localTimeZone()} label="Fuso" />
          <MetaItem value="22°" label="Céu limpo" />
          <MetaItem value="Pronta" label="IA" tone="ok" />
        </div>
      </header>

      <section
        className={cn(
          // Sem `overflow-hidden`: o fio de luz do topo já não transborda, e o
          // recorte cortava o teclado do PIN, que é mais alto que o cartão base.
          'relative w-[min(520px,94vw)] rounded-card border border-line-2',
          'bg-glass/[.55] px-s3 py-s4 backdrop-blur-glass',
          'shadow-2 [box-shadow:var(--sh-2),inset_0_1px_0_rgb(255_255_255_/_0.07)]',
          isShaking && 'animate-shake',
          // Glow vermelho no erro (Parte 5 §Erros).
          hint.tone === 'error' && 'border-danger/40 [box-shadow:0_0_28px_rgba(239,68,68,.22)]',
        )}
      >
        {/* Fio de luz no topo do cartão. */}
        <span className="absolute inset-x-[10%] top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

        <button
          ref={avatarRef}
          type="button"
          onClick={runFaceScan}
          aria-label="Autenticar por reconhecimento facial"
          className={cn(
            'relative mx-auto flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full',
            'border border-accent/[.28] bg-gradient-to-br from-[#1d2f42] to-[#0a141d]',
            'text-[34px] font-light tracking-[0.06em] text-accent',
            'transition-[transform,box-shadow] duration-[240ms] ease-out',
            'hover:scale-[1.02] hover:rotate-[1.5deg] hover:shadow-glow',
            'compact:h-24 compact:w-24 compact:text-[28px]',
          )}
        >
          AQ
          {isScanningFace && (
            <span className="absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
              <span className="login-face-scan" />
            </span>
          )}
        </button>

        <div className="mt-s2 text-center">
          <b className="block text-[22px] font-medium">{USER_NAME}</b>
          <span className="text-[13px] text-t3">Último acesso hoje, 02:14</span>
        </div>

        <div className="mt-s2 flex flex-wrap justify-center gap-s2">
          <InfoChip icon={Monitor} text="Pegasus V7" />
          <InfoChip icon={Wifi} text="Rede local" />
          <InfoChip icon={Shield} text="Sessão segura" />
        </div>

        {method === 'pin' ? (
          <PinKeypad
            onComplete={() => grant('Identidade confirmada.')}
            onCancel={() => setMethod('password')}
          />
        ) : (
          /*
           * Um `<form>` a sério, e não um `<div>` com um handler de Enter: é o
           * que faz os gestores de palavras-passe e o autopreenchimento do
           * Android reconhecerem o campo, e o que dá o Enter de graça. O Chrome
           * avisa na consola quando um campo de palavra-passe fica fora de um
           * formulário — com razão.
           */
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {/*
              Campo de utilizador escondido. O sistema é de um só utilizador e
              não o pede, mas sem ele os gestores de palavras-passe não sabem a
              que conta associar a credencial — e o Chrome avisa-o na consola.
              `hidden` mantém-no fora da ordem de tabulação e do leitor de ecrã.
            */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value="anderson.quadri"
              readOnly
              hidden
            />

            <div
              className={cn(
                'mt-s3 flex h-14 items-center gap-2.5 rounded-input border border-line bg-tint/[.03] px-4',
                'transition-[border-color,box-shadow] duration-200',
                'focus-within:border-accent/[.42] focus-within:shadow-[0_0_0_4px_rgba(0,207,255,.07)]',
              )}
            >
              <Lock className="h-[17px] w-[17px] flex-shrink-0 text-t3" aria-hidden="true" />
              <input
                ref={inputRef}
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
                name="password"
                placeholder="Palavra-passe"
                aria-label="Palavra-passe"
                aria-describedby="pw-strength pw-caps"
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent text-[15px] tracking-[0.14em] outline-none placeholder:tracking-normal placeholder:text-t3"
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
                className="flex p-1 text-t3 transition-colors hover:text-accent"
              >
                {isPasswordVisible ? (
                  <EyeOff className="h-[17px] w-[17px]" />
                ) : (
                  <Eye className="h-[17px] w-[17px]" />
                )}
              </button>
            </div>

            {/* CAPS LOCK: só se anuncia quando está mesmo ligado. */}
            <p
              id="pw-caps"
              aria-live="polite"
              className={cn(
                'mt-1.5 h-4 text-[11px] text-warn transition-opacity duration-hover',
                isCapsLockOn ? 'opacity-100' : 'opacity-0',
              )}
            >
              {isCapsLockOn ? 'CAPS LOCK está ligado' : ''}
            </p>

            {password.length > 0 && (
              <div id="pw-strength" className="mt-1 flex items-center gap-2.5">
                <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-tint/[.06]">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-[width,background] duration-300 ease-out',
                      strength.color === 'danger' && 'bg-danger',
                      strength.color === 'warn' && 'bg-warn',
                      strength.color === 'accent' && 'bg-accent',
                      strength.color === 'ok' && 'bg-ok',
                    )}
                    style={{ width: `${strength.percent}%` }}
                  />
                </span>
                <span className="w-[62px] text-right text-[10.5px] text-t3">{strength.label}</span>
              </div>
            )}

            <button
              type="submit"
              className={cn(
                'mt-s2 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-btn',
                'bg-accent text-[15px] font-semibold text-[#04121A]',
                'transition-[transform,box-shadow] duration-hover ease-out',
                'hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(0,207,255,.4)] active:scale-[.98]',
              )}
            >
              <Unlock className="h-[17px] w-[17px]" aria-hidden="true" />
              Entrar
            </button>
          </form>
        )}

        <div className="mt-s3 flex justify-center gap-2.5">
          <MethodButton icon={ScanFace} label="Reconhecimento facial" onClick={runFaceScan} />
          <MethodButton icon={Fingerprint} label="Impressão digital" onClick={runFingerprintScan} />
          <MethodButton icon={Grid3x3} label="PIN" onClick={() => setMethod('pin')} />
          <MethodButton icon={KeyRound} label="Chave física" onClick={runSecurityKey} />
        </div>

        <AssistantHint text={hint.text} tone={hint.tone} />
      </section>

      {/* Atalhos do sistema (Parte 5 §Atalhos e rodapé). */}
      <div className="flex flex-wrap justify-center gap-2">
        <SystemAction icon={Power} label="Desligar" />
        <SystemAction icon={RotateCcw} label="Reiniciar" />
        <SystemAction icon={Moon} label="Suspender" />
        <SystemAction icon={Accessibility} label="Acessibilidade" />
        <SystemAction icon={Languages} label="Idioma" />
        <SystemAction icon={Wifi} label="Rede" />
      </div>

      <footer className="flex flex-wrap justify-center gap-s3 text-[11px] text-t3">
        <InfoChip icon={Cpu} text="v1.0.0 · Project ARC" muted />
        <InfoChip icon={HardDrive} text="Licença ativa" muted />
        <InfoChip icon={Globe} text="192.168.1.42" muted />
        <InfoChip icon={Activity} text="Memória 412 MB" muted />
      </footer>
    </div>
  );
}

/**
 * As frases da IA entram com efeito de digitação (Parte 5 §Mensagens da IA).
 *
 * A `key` no texto reinicia o typewriter a cada frase nova — sem ela, a
 * mudança de frase apareceria de uma vez.
 */
function AssistantHint({
  text,
  tone,
}: {
  readonly text: string;
  readonly tone: HintTone;
}): React.JSX.Element {
  return (
    <TypedLine key={text} text={text} tone={tone} />
  );
}

function TypedLine({
  text,
  tone,
}: {
  readonly text: string;
  readonly tone: HintTone;
}): React.JSX.Element {
  const { typed } = useTypewriter(text, { speedMs: 18, jitterMs: 14 });

  return (
    <p
      aria-live="polite"
      className={cn(
        'mt-s2 min-h-[17px] text-center text-[11.5px]',
        tone === 'error' && 'text-danger',
        tone === 'ok' && 'text-ok',
        tone === 'neutral' && 'text-t3',
      )}
    >
      {typed}
    </p>
  );
}

/** Fuso horário do sistema, em formato curto. */
function localTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone.split('/').at(-1)?.replace(/_/g, ' ') ?? zone;
  } catch {
    // Ambiente sem Intl completo — o campo simplesmente não informa.
    return '—';
  }
}

interface MetaItemProps {
  readonly value: string;
  readonly label: string;
  readonly mono?: boolean;
  readonly tone?: 'ok';
}

function MetaItem({ value, label, mono = false, tone }: MetaItemProps): React.JSX.Element {
  return (
    <div className="text-center">
      <b className={cn('block text-[15px] font-medium', mono && 'mono', tone === 'ok' && 'text-ok')}>
        {value}
      </b>
      <span className="text-[10px] uppercase tracking-[0.12em] text-t3">{label}</span>
    </div>
  );
}

interface InfoChipProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly text: string;
  readonly muted?: boolean;
}

function InfoChip({ icon: Icon, text, muted = false }: InfoChipProps): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-t3">
      <Icon className={cn('h-[13px] w-[13px]', muted ? 'text-t3' : 'text-accent opacity-75')} />
      {text}
    </span>
  );
}

interface MethodButtonProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
  readonly onClick: () => void;
}

function MethodButton({ icon: Icon, label, onClick }: MethodButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-[46px] w-[46px] items-center justify-center rounded-input border border-line text-t3',
        'transition-all duration-hover ease-out active:scale-95',
        'hover:border-accent/35 hover:bg-accent/5 hover:text-accent',
      )}
    >
      <Icon className="h-[19px] w-[19px]" />
    </button>
  );
}

/**
 * Atalhos de sistema no rodapé.
 *
 * Desligar e suspender exigiriam permissões que a capability não concede — e
 * não devem concedê-las a partir de um ecrã de autenticação. Ficam a informar
 * que a ação não está disponível, em vez de fingirem funcionar.
 */
function SystemAction({
  icon: Icon,
  label,
}: {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() =>
        notificationService.info(label, 'Esta ação faz parte da gestão de energia da Fase 2.')
      }
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border border-line/60 text-t3',
        'transition-all duration-hover ease-out hover:border-accent/30 hover:text-accent',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
