import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Mic, Send, User } from 'lucide-react';

import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/cn';
import { aiService } from '@/services/ai-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import type { AssistantMessage } from '@/types/assistant';

/** Mensagem de abertura, escrita uma vez por sessão. */
const GREETING =
  'Bom dia, Anderson. Todos os módulos responderam dentro do tempo esperado. Tem três emails a pedir ação e o primeiro compromisso às 10:00.';

/**
 * Janela do assistente.
 *
 * Só desenha o histórico e envia o que se escreve. Quem trata da resposta é o
 * `AIService`, e quem trata do modo do núcleo é o store — a janela não decide
 * nem uma coisa nem outra.
 */
export default function AssistantWindow(): React.JSX.Element {
  const messages = useAssistantStore((state) => state.messages);
  const mode = useAssistantStore((state) => state.mode);
  const addMessage = useAssistantStore((state) => state.addMessage);

  // Esta janela já é o assistente — uma transcrição não precisa de a abrir.
  const { isSupported: isVoiceSupported, toggleListening } = useVoice({
    onLaunchApp: () => undefined,
  });

  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A saudação só entra se a conversa estiver mesmo vazia — reabrir a janela
  // não deve repetir o cumprimento por cima do histórico.
  useEffect(() => {
    if (useAssistantStore.getState().messages.length === 0) {
      addMessage('assistant', GREETING);
    }
    inputRef.current?.focus();
  }, [addMessage]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback((): void => {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft('');
    void aiService.send(text);
  }, [draft]);

  return (
    <div className="flex h-full flex-col">
      <div ref={logRef} className="mb-s2 flex flex-1 flex-col gap-3.5 overflow-y-auto">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      <div
        className={cn(
          'flex h-[52px] flex-shrink-0 items-center gap-2 rounded-input border border-line',
          'bg-tint/[.03] py-0 pl-4 pr-2 transition-[border-color,box-shadow] duration-200',
          'focus-within:border-accent/[.42] focus-within:shadow-[0_0_0_4px_rgba(0,207,255,.06)]',
        )}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
          placeholder="Escreva ou fale um comando"
          aria-label="Comando para o assistente"
          className="min-w-0 flex-1 bg-transparent text-desc outline-none placeholder:text-t3"
        />

        {/* O microfone só aparece onde há reconhecimento de voz. */}
        {isVoiceSupported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={mode === 'listening' ? 'Desligar microfone' : 'Ligar microfone'}
            aria-pressed={mode === 'listening'}
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-line text-t2',
              'transition-all duration-hover ease-out hover:border-accent/35 hover:text-accent',
              mode === 'listening' && 'border-danger/35 bg-danger/[.12] text-danger',
            )}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={send}
          aria-label="Enviar"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-[#04121A] transition-all duration-hover ease-out hover:shadow-glow"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { readonly message: AssistantMessage }): React.JSX.Element {
  const isAssistant = message.author === 'assistant';
  const Icon = isAssistant ? Bot : User;

  return (
    <article className="flex gap-[11px] motion-safe:animate-window-in">
      <span
        className={cn(
          'flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg border',
          isAssistant
            ? 'border-accent/25 bg-accent/[.12] text-accent'
            : 'border-line bg-white/5 text-t2',
        )}
        aria-hidden="true"
      >
        <Icon className="h-[13px] w-[13px]" />
      </span>

      <div className="min-w-0">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-t3">
          {isAssistant ? 'Jarvis' : 'Anderson'}
        </div>
        <p className={cn('text-desc leading-[1.62]', isAssistant ? 'text-t1' : 'text-t2')}>
          {message.text}
          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-[14px] w-[7px] translate-y-[2px] bg-accent motion-safe:animate-blink" />
          )}
        </p>
      </div>
    </article>
  );
}
