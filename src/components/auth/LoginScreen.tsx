import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Grid3x3,
  HardDrive,
  KeyRound,
  Lock,
  Monitor,
  ScanFace,
  Shield,
  Unlock,
  Wifi,
} from 'lucide-react';

import { useClock } from '@/hooks/use-clock';
import { useReducedMotion } from '@/hooks/use-media-query';
import { cn } from '@/lib/cn';
import { formatLongDate, formatTime } from '@/lib/format';

/** Frases que o assistente vai dizendo enquanto espera pela autenticação. */
const ASSISTANT_LINES = [
  'Bom dia, Anderson.',
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

interface LoginScreenProps {
  readonly onAuthenticated: () => void;
}

/**
 * Ecrã de autenticação.
 *
 * A biometria é simulada — é o que o MVP prevê. Está isolada em handlers
 * próprios para que ligar o Windows Hello mais tarde seja trocar o corpo de
 * `runFaceScan` e `runFingerprintScan`, sem tocar no resto do ecrã.
 */
export function LoginScreen({ onAuthenticated }: LoginScreenProps): React.JSX.Element {
  const now = useClock();
  const reducedMotion = useReducedMotion();

  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [hint, setHint] = useState<{ text: string; tone: HintTone }>({
    text: ASSISTANT_LINES[0],
    tone: 'neutral',
  });
  const [isScanningFace, setScanningFace] = useState(false);
  const [isShaking, setShaking] = useState(false);
  const [isLeaving, setLeaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isResolvedRef = useRef(false);

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

      setHint({ text: message, tone: 'ok' });
      timersRef.current.push(
        setTimeout(() => {
          setLeaving(true);
          timersRef.current.push(
            setTimeout(onAuthenticated, reducedMotion ? 0 : GRANT_DELAY_MS),
          );
        }, reducedMotion ? 0 : GRANT_DELAY_MS),
      );
    },
    [onAuthenticated, reducedMotion],
  );

  const deny = useCallback((): void => {
    setShaking(true);
    timersRef.current.push(setTimeout(() => setShaking(false), 440));
    setHint({
      text: 'Não foi possível verificar a identidade. Tente novamente.',
      tone: 'error',
    });
    inputRef.current?.focus();
  }, []);

  const submit = useCallback((): void => {
    if (password.trim().length > 0) {
      grant('Identidade confirmada.');
    } else {
      deny();
    }
  }, [deny, grant, password]);

  const runFaceScan = useCallback((): void => {
    setScanningFace(true);
    setHint({ text: 'A analisar biometria…', tone: 'neutral' });
    timersRef.current.push(
      setTimeout(() => {
        setScanningFace(false);
        grant('Acesso autorizado.');
      }, reducedMotion ? 0 : FACE_SCAN_MS),
    );
  }, [grant, reducedMotion]);

  const runFingerprintScan = useCallback((): void => {
    if (reducedMotion) {
      grant('Identidade confirmada.');
      return;
    }

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
  }, [grant, reducedMotion]);

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
          <MetaItem value="22°" label="Céu limpo" />
          <MetaItem value="Pronta" label="IA" tone="ok" />
        </div>
      </header>

      <section
        className={cn(
          'relative w-[min(520px,94vw)] overflow-hidden rounded-card border border-line-2',
          'bg-[rgb(16_25_34_/_0.55)] px-s3 py-s4 backdrop-blur-glass',
          'shadow-2 [box-shadow:var(--sh-2),inset_0_1px_0_rgb(255_255_255_/_0.07)]',
          isShaking && 'animate-shake',
        )}
      >
        {/* Fio de luz no topo do cartão. */}
        <span className="absolute inset-x-[10%] top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

        <button
          type="button"
          onClick={runFaceScan}
          aria-label="Autenticar por reconhecimento facial"
          className={cn(
            'relative mx-auto flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full',
            'border border-accent/[.28] bg-gradient-to-br from-[#1d2f42] to-[#0a141d]',
            'text-[34px] font-light tracking-[0.06em] text-accent',
            'transition-[transform,box-shadow] duration-[240ms] ease-out',
            'hover:scale-[1.02] hover:shadow-glow',
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
          <b className="block text-[22px] font-medium">Anderson Quadri</b>
          <span className="text-[13px] text-t3">Último acesso hoje, 02:14</span>
        </div>

        <div className="mt-s2 flex flex-wrap justify-center gap-s2">
          <InfoChip icon={Monitor} text="Pegasus V7" />
          <InfoChip icon={Wifi} text="Rede local" />
          <InfoChip icon={Shield} text="Sessão segura" />
        </div>

        <div
          className={cn(
            'mt-s3 flex h-14 items-center gap-2.5 rounded-input border border-line bg-white/[.03] px-4',
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
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            placeholder="Palavra-passe"
            aria-label="Palavra-passe"
            autoComplete="current-password"
            className="min-w-0 flex-1 bg-transparent text-[15px] tracking-[0.14em] outline-none placeholder:tracking-normal placeholder:text-t3"
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={isPasswordVisible ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
            className="flex p-1 text-t3 transition-colors hover:text-accent"
          >
            {isPasswordVisible ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
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

        <div className="mt-s3 flex justify-center gap-2.5">
          <MethodButton icon={ScanFace} label="Reconhecimento facial" onClick={runFaceScan} />
          <MethodButton icon={Fingerprint} label="Impressão digital" onClick={runFingerprintScan} />
          <MethodButton icon={Grid3x3} label="PIN" onClick={deny} />
          <MethodButton icon={KeyRound} label="Chave física" onClick={deny} />
        </div>

        <p
          aria-live="polite"
          className={cn(
            'mt-s2 min-h-[17px] text-center text-[11.5px]',
            hint.tone === 'error' && 'text-danger',
            hint.tone === 'ok' && 'text-ok',
            hint.tone === 'neutral' && 'text-t3',
          )}
        >
          {hint.text}
        </p>
      </section>

      <footer className="flex flex-wrap justify-center gap-s3 text-[11px] text-t3">
        <InfoChip icon={Cpu} text="v1.0.0 · Project ARC" muted />
        <InfoChip icon={HardDrive} text="Licença ativa" muted />
        <InfoChip icon={Globe} text="192.168.1.42" muted />
        <InfoChip icon={Activity} text="Memória 412 MB" muted />
      </footer>
    </div>
  );
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
        'transition-all duration-hover ease-out',
        'hover:border-accent/35 hover:bg-accent/5 hover:text-accent',
      )}
    >
      <Icon className="h-[19px] w-[19px]" />
    </button>
  );
}
