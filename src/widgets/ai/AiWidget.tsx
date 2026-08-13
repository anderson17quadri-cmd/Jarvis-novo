import { useSyncExternalStore } from 'react';
import { Lightbulb, X } from 'lucide-react';

import { useCopilot } from '@/hooks/use-copilot';
import { cn } from '@/lib/cn';
import { aiService } from '@/services/ai-service';
import { memoryService } from '@/services/assistant/memory-service';
import { runTool } from '@/services/assistant/tool-runner';
import { notificationService } from '@/services/notification-service';
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
 * As **sugestões** entraram (Parte 11), mas não como eu tinha escrito aqui que
 * não entrariam: não são frases inventadas a fingir de inteligência. Cada uma
 * parte de uma contagem — tarefas fora do prazo, janelas abertas — e propõe uma
 * ferramenta que já existe. As regras estão no `services/assistant/copilot.ts`,
 * com a lista do que ficou de fora e porquê.
 *
 * O que **não** mostra: consumo de tokens — não há provedor que os conte.
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
  const { suggestions, dismiss } = useCopilot();
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

      {suggestions.length > 0 && (
        <ul className="mb-2 flex-shrink-0 space-y-1">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.id}
              className="flex items-center gap-1.5 rounded-input border border-accent/25 bg-accent/[.05] px-2 py-1.5"
            >
              <Lightbulb className="h-3 w-3 flex-shrink-0 text-accent" aria-hidden="true" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] text-t2">{suggestion.fact}</span>
                <button
                  type="button"
                  onClick={() => {
                    void runTool(suggestion.call).then((outcome) => {
                      /*
                       * Só se dispensa se correu bem.
                       *
                       * Uma sugestão que se apaga sozinha depois de falhar é
                       * pior do que uma que fica: a pessoa carrega, não acontece
                       * nada, e o convite desaparece sem explicação. Já
                       * aconteceu neste ficheiro, com um argumento com o nome
                       * errado.
                       */
                      if (outcome.status !== 'ok') {
                        notificationService.error('A sugestão não deu', outcome.message);
                        return;
                      }

                      dismiss(suggestion.id);
                    });
                  }}
                  className="text-[10.5px] font-medium text-accent transition-opacity duration-hover hover:opacity-75"
                >
                  {suggestion.label}
                </button>
              </span>

              <button
                type="button"
                onClick={() => dismiss(suggestion.id)}
                aria-label={`Dispensar: ${suggestion.fact}`}
                className="flex-shrink-0 rounded p-0.5 text-t3 transition-colors duration-hover hover:text-t1"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

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
