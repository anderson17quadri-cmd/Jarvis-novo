/**
 * Host do overlay de controlo direto — Fase 3.2.
 *
 * O `ControlOverlay` (Fase 3.1) estava construído mas nunca montado: nada o
 * punha no ecrã, por isso o fluxo de confirmação nunca se via. Este componente
 * é o único ponto que decide isso: quando há um passo pendente no
 * `directControlService`, mostra o overlay por cima de tudo; sem passo, não
 * renderiza nada.
 */

import { useSyncExternalStore } from 'react';

import { ControlOverlay } from '@/components/ControlOverlay';
import { directControlService } from '@/services/direct-control-service';

export function DirectControlHost(): React.JSX.Element | null {
  const pending = useSyncExternalStore(
    (onChange) => directControlService.subscribe(onChange),
    () => directControlService.pending,
  );

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
