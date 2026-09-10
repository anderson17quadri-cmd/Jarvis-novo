/**
 * Host do overlay de controlo direto — Fase 3.2.
 *
 * O `ControlOverlay` (Fase 3.1) estava construído mas nunca montado: nada o
 * punha no ecrã, por isso o fluxo de confirmação nunca se via. Este componente
 * é o único ponto que decide isso: quando há um passo pendente no
 * `directControlService`, mostra o overlay por cima de tudo; sem passo, não
 * renderiza nada.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { ControlOverlay } from '@/components/ControlOverlay';
import { directControlService } from '@/services/direct-control-service';

/** Janela em que duas teclas `Esc` contam como "travão de mão". */
const HANDBRAKE_WINDOW_MS = 500;

export function DirectControlHost(): React.JSX.Element | null {
  const pending = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.pending,
  );

  // Travão de mão (Fase 3.4): duas vezes em `Esc` num curto espaço, para tudo.
  // Vive aqui e não no overlay porque deve estar ativo mesmo sem passo pendente —
  // acabar uma sessão de controlo direto antes de qualquer pedido é tão válido
  // como travar um passo a meio. Um único `Esc` não faz nada de propósito: o
  // gesto forte é a marca do gesto de pânico, não um atalho acidental.
  const lastEscAtRef = useRef(0);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        lastEscAtRef.current = 0;
        return;
      }

      const now = Date.now();
      const isDouble = now - lastEscAtRef.current < HANDBRAKE_WINDOW_MS;
      lastEscAtRef.current = now;

      if (isDouble) directControlService.emergencyStop();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!pending) return null;

  return (
    <ControlOverlay
      stepDescription={pending.description}
      stepRisk={pending.risk}
      onConfirm={() => directControlService.confirm()}
      onCancel={() => directControlService.cancel()}
    />
  );
}
