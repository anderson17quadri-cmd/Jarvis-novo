import { useSyncExternalStore } from 'react';
import { Shield, Square } from 'lucide-react';
import { useClock } from '@/hooks/use-clock';
import { directControlService } from '@/services/direct-control-service';

export function DirectControlStatus(): React.JSX.Element | null {
  useClock();
  const token = useSyncExternalStore(
    listener => directControlService.subscribe(listener),
    () => directControlService.sessionToken,
  );
  if (token === null) return null;
  const seconds = directControlService.sessionRemainingSeconds;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <div role="status" aria-label="Sessão de Controlo Direto"
      className="fixed bottom-[calc(var(--dock-h,80px)+24px)] right-3 z-[9998] flex items-center gap-2 rounded-input border border-warn/50 bg-bg2 px-3 py-2 text-cap text-warn shadow-lg">
      <Shield className="h-4 w-4" aria-hidden="true" />
      <span>Controlo {directControlService.isSimulated ? 'simulado' : 'Direto'}</span>
      <span className="mono" aria-label="Tempo restante">{time}</span>
      <button type="button" aria-label="Parar Controlo Direto"
        onClick={() => directControlService.emergencyStop()}
        className="flex items-center gap-1 rounded border border-warn/40 px-2 py-1 hover:bg-warn/10">
        <Square className="h-3 w-3" aria-hidden="true" /> Parar
      </button>
    </div>
  );
}
