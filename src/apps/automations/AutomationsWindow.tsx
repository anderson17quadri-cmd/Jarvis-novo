import { useEffect, useState, useSyncExternalStore } from 'react';
import { History, Info, Play, Power, Trash2, Zap } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { automationService } from '@/services/automation-service';
import {
  describeAction,
  describeCondition,
  describeTrigger,
  RESULT_LABELS,
  type Automation,
  type AutomationRun,
  type RunResult,
} from '@/types/automation';

const RESULT_STYLE: Record<RunResult, string> = {
  ok: 'text-ok',
  'condicoes-nao-cumpridas': 'text-t3',
  erro: 'text-danger',
};

type Tab = 'regras' | 'historico';

/**
 * Automações (Parte 13).
 *
 * Lista as regras, deixa ligá-las, desligá-las, executá-las à mão e ver o que
 * correu. O motor vive no `automationService` — esta janela só o mostra.
 *
 * O estado do serviço lê-se com `useSyncExternalStore` e não com um store do
 * Zustand: o motor corre com ou sem interface aberta, e fazê-lo depender de um
 * store de interface era inverter a dependência.
 */
export default function AutomationsWindow(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('regras');

  const automations = useSyncExternalStore(
    (onChange) => automationService.subscribe(onChange),
    () => automationService.list,
  );
  const history = useSyncExternalStore(
    (onChange) => automationService.subscribe(onChange),
    () => automationService.history,
  );

  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);

  // A mensagem do "Executar agora" apaga-se sozinha — fica no histórico.
  useEffect(() => {
    if (!lastRun) return;
    const timer = setTimeout(() => setLastRun(null), 4_000);
    return () => clearTimeout(timer);
  }, [lastRun]);

  const enabledCount = automations.filter((automation) => automation.isEnabled).length;

  return (
    <div className="flex h-full flex-col gap-s2">
      <p className="flex items-start gap-2 rounded-input border border-line bg-tint/[.02] p-2.5 text-cap text-t3">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Correm enquanto o JARVIS estiver aberto. Gatilhos de ficheiros, USB, bateria e rede
          exigem a camada nativa e ainda não existem.
        </span>
      </p>

      <div role="tablist" aria-label="Vista" className="flex flex-shrink-0 gap-1">
        <TabButton isActive={tab === 'regras'} onClick={() => setTab('regras')}>
          Regras ({enabledCount}/{automations.length})
        </TabButton>
        <TabButton isActive={tab === 'historico'} onClick={() => setTab('historico')}>
          Histórico ({history.length})
        </TabButton>

        {tab === 'historico' && history.length > 0 && (
          <button
            type="button"
            onClick={() => automationService.clearHistory()}
            className="ml-auto text-[11px] text-t3 transition-colors duration-hover hover:text-danger"
          >
            Limpar
          </button>
        )}
      </div>

      {lastRun && (
        <p
          role="status"
          className={cn('flex-shrink-0 text-[11.5px]', RESULT_STYLE[lastRun.result])}
        >
          {RESULT_LABELS[lastRun.result]}: {lastRun.message}
        </p>
      )}

      {tab === 'regras' ? (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              onRun={() => setLastRun(automationService.run(automation.id, true))}
            />
          ))}

          {automations.length === 0 && (
            <li className="py-s3 text-center text-desc text-t3">Sem regras.</li>
          )}
        </ul>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {history.map((run) => (
            <li
              key={run.id}
              className="flex items-baseline gap-2 rounded-input border border-line bg-tint/[.02] px-2.5 py-2"
            >
              <span className="mono flex-shrink-0 text-[10.5px] text-t3">
                {formatTime(new Date(run.at))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px]">{run.automationName}</span>
                <span className={cn('block text-[10.5px]', RESULT_STYLE[run.result])}>
                  {run.message}
                </span>
              </span>
              <span className="mono flex-shrink-0 text-[10px] text-t3">{run.durationMs}ms</span>
            </li>
          ))}

          {history.length === 0 && (
            <li className="py-s3 text-center text-desc text-t3">
              Ainda nada correu. Ligue uma regra ou execute-a à mão.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function AutomationCard({
  automation,
  onRun,
}: {
  readonly automation: Automation;
  readonly onRun: () => void;
}): React.JSX.Element {
  return (
    <li
      className={cn(
        'rounded-input border border-line bg-tint/[.02] p-3 transition-colors duration-hover',
        !automation.isEnabled && 'opacity-65',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-input border border-line',
            automation.isEnabled ? 'bg-accent/[.08] text-accent' : 'text-t3',
          )}
          aria-hidden="true"
        >
          <Zap className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{automation.name}</p>
          <p className="mt-0.5 text-cap text-t3">{automation.description}</p>
        </div>
      </div>

      <dl className="mt-2.5 space-y-1 text-[10.5px]">
        <Row term="Quando">{describeTrigger(automation.trigger)}</Row>
        {automation.conditions.length > 0 && (
          <Row term="Se">{automation.conditions.map(describeCondition).join(' · ')}</Row>
        )}
        <Row term="Então">{automation.actions.map(describeAction).join(' · ')}</Row>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={automation.isEnabled}
          aria-label={`Ligar ou desligar: ${automation.name}`}
          onClick={() => automationService.setEnabled(automation.id, !automation.isEnabled)}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border px-3 py-2 text-[12px] font-medium',
            'transition-all duration-hover ease-out active:scale-[.98] compact:min-h-[44px]',
            automation.isEnabled
              ? 'border-accent/50 bg-accent/[.1] text-accent'
              : 'border-line text-t2 hover:border-accent/35 hover:text-accent',
          )}
        >
          <Power className="h-3.5 w-3.5" aria-hidden="true" />
          {automation.isEnabled ? 'Ligada' : 'Desligada'}
        </button>

        <button
          type="button"
          onClick={onRun}
          aria-label={`Executar agora: ${automation.name}`}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-btn border border-line px-3 py-2',
            'text-[12px] text-t2 transition-all duration-hover ease-out',
            'hover:border-accent/35 hover:text-accent active:scale-[.98] compact:min-h-[44px]',
          )}
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          Executar
        </button>

        <button
          type="button"
          onClick={() => automationService.remove(automation.id)}
          aria-label={`Apagar: ${automation.name}`}
          className="rounded p-1.5 text-t3 transition-colors duration-hover hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-t3">
          <History className="h-3 w-3" aria-hidden="true" />
          {automation.runCount === 0
            ? 'nunca correu'
            : `${automation.runCount}× · ${formatTime(new Date(automation.lastRunAt ?? 0))}`}
        </span>
      </div>
    </li>
  );
}

function Row({
  term,
  children,
}: {
  readonly term: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex gap-2">
      <dt className="w-[46px] flex-shrink-0 text-t3">{term}</dt>
      <dd className="min-w-0 flex-1 text-t2">{children}</dd>
    </div>
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
