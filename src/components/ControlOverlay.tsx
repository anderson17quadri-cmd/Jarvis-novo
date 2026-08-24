/**
 * Overlay de controlo direto — Fase 3.1.
 *
 * Cobre a janela inteira quando há um passo de controlo direto a confirmar.
 * Mostra a descrição da ação, o risco, e pede confirmação explícita antes de
 * executar (ou simular).
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AlertTriangle, Check, Shield, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { directControlService, RISK_LABELS, type RiskLevel } from '@/services/direct-control-service';

const RISK_STYLE: Record<RiskLevel, string> = {
  baixo: 'text-ok border-ok/30 bg-ok/[.06]',
  medio: 'text-accent border-accent/30 bg-accent/[.06]',
  alto: 'text-[#F6A623] border-[#F6A623]/30 bg-[#F6A623]/[.06]',
  irreversivel: 'text-danger border-danger/30 bg-danger/[.06]',
};

interface ControlOverlayProps {
  readonly stepDescription: string;
  readonly stepRisk: RiskLevel;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ControlOverlay({
  stepDescription,
  stepRisk,
  onConfirm,
  onCancel,
}: ControlOverlayProps): React.JSX.Element {
  const isSimulated = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.isSimulated,
  );

  /*
   * Foco ao abrir, no **Recusar**.
   *
   * Dos quatro `aria-modal` da aplicação, este era o único que não mexia no
   * foco — logo o mais crítico, o que pergunta se o JARVIS pode mexer no
   * computador. Sem isto, o foco ficava onde estava (atrás do overlay), e um
   * Enter reflexo carregava num botão escondido.
   *
   * É o Recusar que recebe o foco, e não o Confirmar: se alguém carregar em
   * Enter sem ler, o que acontece é a ação **não** correr. A confirmação de
   * uma ação sobre o computador tem de ser um gesto deliberado, nunca o
   * caminho de menor esforço.
   */
  const recusarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => recusarRef.current?.focus(), 40);

    /*
     * Escape recusa — ao nível da janela, não do `div`, para funcionar de
     * imediato: com o `onKeyDown` no elemento, os primeiros 40 ms (até o
     * foco entrar) engoliam a tecla. Não colide com o travão de mão: o
     * primeiro Escape recusa este passo, e um segundo logo a seguir continua
     * a acionar o `emergencyStop` do `DirectControlHost`, que fecha a sessão
     * inteira.
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020304]/[.65] backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirmação de controlo direto"
    >
      <div className="mx-4 w-full max-w-[440px] rounded-card border border-line/40 bg-surface p-s3 shadow-[0_8px_40px_rgba(0,0,0,.45)]">
        {/* Cabeçalho */}
        <div className="mb-s2 flex items-start gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-danger/30 bg-danger/[.08]">
            <Shield className="h-4.5 w-4.5 text-danger" />
          </span>
          <div>
            <p className="text-[13px] font-semibold">Controlo direto</p>
            <p className="text-[11px] text-t3">
              O JARVIS pede para executar esta ação no teu computador.
            </p>
          </div>
        </div>

        {/* Ação */}
        <div className="rounded-input border border-line bg-tint/[.03] p-2.5">
          <p className="text-[12px] font-medium">{stepDescription}</p>
          <span
            className={cn(
              'mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
              RISK_STYLE[stepRisk],
            )}
          >
            {RISK_LABELS[stepRisk]}
          </span>
        </div>

        {/* Aviso de simulação */}
        {isSimulated && (
          <p className="flex items-center gap-1.5 mt-s2 rounded-input border border-[#F6A623]/40 bg-[#F6A623]/[.06] px-2.5 py-2 text-[11px] text-[#F6A623]">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            Modo simulado — a ação não vai executar a sério.
          </p>
        )}

        {/* Botões */}
        <div className="mt-s2 flex gap-2">
          <button
            ref={recusarRef}
            type="button"
            onClick={onCancel}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-btn border border-line py-2.5',
              'text-[12px] font-medium text-t2 transition-all duration-hover hover:border-danger/35 hover:text-danger active:scale-[.98]',
            )}
          >
            <X className="h-3.5 w-3.5" />
            Recusar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-btn py-2.5',
              'text-[12px] font-medium transition-all duration-hover active:scale-[.98]',
              'bg-accent text-[#04121A] hover:shadow-glow',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
