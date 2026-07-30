import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/cn';
import { aiService } from '@/services/ai-service';
import { memoryService } from '@/services/assistant/memory-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AssistantMode } from '@/types/assistant';

/**
 * IA (Parte 6.2 §Widgets previstos).
 *
 * A especificação pede "resumo do dia, sugestões, comandos recentes, FAQ,
 * estado da IA, consumo". Este mostra os três que são verificáveis: o estado
 * do assistente, o provedor que está mesmo ligado, e os últimos pedidos, que
 * vêm da memória local.
 *
 * O que **não** mostra: consumo de tokens — não há provedor que os conte —,
 * nem "sugestões", que sem modelo de linguagem seriam frases inventadas a
 * fingir de inteligência. Ficam registados no `SPEC.md`.
 */

const MODE_LABELS: Record<AssistantMode, string> = {
  idle: 'Em espera',
  listening: 'A ouvir',
  thinking: 'A analisar',
  speaking: 'A responder',
  error: 'Erro no último pedido',
  success: 'Concluído',
};

const MODE_COLOURS: Record<AssistantMode, string> = {
  idle: 'bg-t3',
  listening: 'bg-danger',
  thinking: 'bg-warn',
  speaking: 'bg-accent',
  error: 'bg-danger',
  success: 'bg-ok',
};

export default function AiWidget(): React.JSX.Element {
  const mode = useAssistantStore((state) => state.mode);
  const conversations = useAssistantStore((state) => state.conversations);

  const memory = useSyncExternalStore(
    (onChange) => memoryService.subscribe(onChange),
    () => memoryService.current,
  );

  const messageCount = conversations.reduce(
    (total, conversation) => total + conversation.messages.length,
    0,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-shrink-0 items-center gap-2">
        <span
          className={cn(
            'h-[7px] w-[7px] flex-shrink-0 rounded-full',
            MODE_COLOURS[mode],
            mode !== 'idle' && 'motion-safe:animate-breathe',
          )}
          aria-hidden="true"
        />
        <span className="text-[13px] font-medium leading-none compact:text-[12px]">
          {MODE_LABELS[mode]}
        </span>
      </div>

      <dl className="mb-2 flex-shrink-0 space-y-0.5 text-[10.5px]">
        <div className="flex gap-2">
          <dt className="text-t3">Provedor</dt>
          <dd className="ml-auto truncate text-t2">{aiService.providerName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-t3">Conversas</dt>
          <dd className="mono ml-auto text-t2">
            {conversations.length} · {messageCount} mensagens
          </dd>
        </div>
      </dl>

      <p className="t-label mb-1 flex-shrink-0">Últimos pedidos</p>

      {memory.recentPrompts.length === 0 ? (
        <p className="text-[10.5px] leading-relaxed text-t3">
          Ainda não pediu nada. Escreva no assistente ou fale, e aparece aqui.
        </p>
      ) : (
        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {memory.recentPrompts.map((prompt) => (
            <li key={prompt} className="truncate text-[11px] text-t2">
              {prompt}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-1.5 flex-shrink-0 text-[9.5px] text-t3">
        Sem modelo de linguagem ligado
      </p>
    </div>
  );
}
